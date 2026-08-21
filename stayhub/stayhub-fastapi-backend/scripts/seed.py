"""Fill an empty database with something worth looking at, then build the search index.

Idempotent: it clears StayHub's own tables first, so running it twice gives the same result rather
than duplicating everything.

    .venv/bin/python -m scripts.seed
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, text

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.booking import Booking, Payment, Review
from app.models.enums import BookingStatus, PropertyStatus, PropertyType, RoomType, UserRole
from app.models.property import Amenity, Property, PropertyImage, property_amenities
from app.models.user import User
from app.search import indexer
from app.services import pricing_service

AMENITIES = [
    ("wifi", "Wifi", "wifi"),
    ("kitchen", "Kitchen", "utensils"),
    ("free-parking", "Free parking", "car"),
    ("pool", "Pool", "waves"),
    ("hot-tub", "Hot tub", "bath"),
    ("air-conditioning", "Air conditioning", "wind"),
    ("heating", "Heating", "flame"),
    ("washer", "Washer", "shirt"),
    ("dryer", "Dryer", "sun"),
    ("tv", "TV", "tv"),
    ("workspace", "Dedicated workspace", "laptop"),
    ("pets-allowed", "Pets allowed", "dog"),
    ("bbq-grill", "BBQ grill", "beef"),
    ("fireplace", "Fireplace", "flame"),
    ("gym", "Gym", "dumbbell"),
    ("beach-access", "Beach access", "umbrella"),
    ("ski-in-out", "Ski-in/ski-out", "snowflake"),
    ("ev-charger", "EV charger", "plug"),
]

# Unsplash's `source`-style CDN URLs, so no image files need to live in the repo. A real app would
# upload to S3 and store a key, not a third party's URL.
def photo(photo_id: str, w: int = 1200) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?w={w}&q=80&auto=format&fit=crop"


LISTINGS = [
    {
        "title": "Sunlit Loft in the Mission",
        "city": "San Francisco", "state": "California", "country": "United States",
        "lat": Decimal("37.7599"), "lon": Decimal("-122.4148"),
        "type": PropertyType.LOFT, "room": RoomType.ENTIRE_PLACE,
        "price": "215.00", "cleaning": "75.00",
        "guests": 4, "bedrooms": 2, "beds": 2, "baths": "1.5",
        "rating": "4.87", "reviews": 128,
        "amenities": ["wifi", "kitchen", "washer", "workspace", "heating", "tv"],
        "photos": ["1502672260266-1c1ef2d93688", "1493809842364-78817add7ffb", "1522708323590-d24dbb6b0267"],
        "description": (
            "A bright corner loft two blocks from Dolores Park. Fourteen-foot windows, a proper "
            "espresso setup, and a desk that actually works for a full day. The neighbourhood "
            "coffee is the best in the city and you will hear about it from every local."
        ),
    },
    {
        "title": "Cedar Cabin with Mountain Views",
        "city": "Big Bear Lake", "state": "California", "country": "United States",
        "lat": Decimal("34.2439"), "lon": Decimal("-116.9114"),
        "type": PropertyType.CABIN, "room": RoomType.ENTIRE_PLACE,
        "price": "189.00", "cleaning": "95.00",
        "guests": 6, "bedrooms": 3, "beds": 4, "baths": "2.0",
        "rating": "4.93", "reviews": 214,
        "amenities": ["wifi", "kitchen", "free-parking", "hot-tub", "fireplace", "ski-in-out", "bbq-grill"],
        "photos": ["1449158743715-0a90ebb6d2d8", "1518780664697-55e3ad937233", "1470770841072-f978cf4d019e"],
        "description": (
            "Woodsmoke, a deck facing the ridge, and a hot tub that earns its keep in February. "
            "Ten minutes from the slopes, far enough that you hear nothing but trees at night."
        ),
    },
    {
        "title": "Oceanfront Villa, Private Steps to Sand",
        "city": "Maui", "state": "Hawaii", "country": "United States",
        "lat": Decimal("20.7984"), "lon": Decimal("-156.3319"),
        "type": PropertyType.VILLA, "room": RoomType.ENTIRE_PLACE,
        "price": "645.00", "cleaning": "220.00",
        "guests": 8, "bedrooms": 4, "beds": 5, "baths": "3.5",
        "rating": "4.98", "reviews": 89,
        "amenities": ["wifi", "kitchen", "pool", "air-conditioning", "beach-access", "free-parking", "bbq-grill", "washer"],
        "photos": ["1613490493576-7fde63acd811", "1600596542815-ffad4c1539a9", "1512917774080-9991f1c4c750"],
        "description": (
            "The lanai is the whole point: you eat every meal on it. Private stairs put you on "
            "the sand in under a minute, and the snorkelling is directly out front. Sleeps eight "
            "without anyone drawing the short straw."
        ),
    },
    {
        "title": "Quiet Studio near Zilker Park",
        "city": "Austin", "state": "Texas", "country": "United States",
        "lat": Decimal("30.2669"), "lon": Decimal("-97.7729"),
        "type": PropertyType.APARTMENT, "room": RoomType.ENTIRE_PLACE,
        "price": "128.00", "cleaning": "45.00",
        "guests": 2, "bedrooms": 1, "beds": 1, "baths": "1.0",
        "rating": "4.79", "reviews": 342,
        "amenities": ["wifi", "kitchen", "air-conditioning", "workspace", "free-parking", "pets-allowed"],
        "photos": ["1522708323590-d24dbb6b0267", "1560448204-e02f11c3d0e2", "1484154218962-a197022b5858"],
        "description": (
            "Small, well made, and walkable to Barton Springs. The bed is a real mattress and the "
            "wifi holds up to video calls, which is more than the price suggests."
        ),
    },
    {
        "title": "Brownstone Garden Apartment",
        "city": "Brooklyn", "state": "New York", "country": "United States",
        "lat": Decimal("40.6782"), "lon": Decimal("-73.9442"),
        "type": PropertyType.APARTMENT, "room": RoomType.ENTIRE_PLACE,
        "price": "245.00", "cleaning": "85.00",
        "guests": 4, "bedrooms": 2, "beds": 2, "baths": "1.0",
        "rating": "4.85", "reviews": 176,
        "amenities": ["wifi", "kitchen", "heating", "washer", "dryer", "workspace", "tv"],
        "photos": ["1560448204-603b3fc33ddc", "1502005229762-cf1b2da7c5d6", "1493663284031-b7e3aefcae8e"],
        "description": (
            "The garden is the reason to book: a walled patio with a fig tree, in Park Slope. "
            "Two subway lines within five minutes and a bakery worth the queue on the corner."
        ),
    },
    {
        "title": "Desert House with Pool and Starlight",
        "city": "Joshua Tree", "state": "California", "country": "United States",
        "lat": Decimal("34.1347"), "lon": Decimal("-116.3131"),
        "type": PropertyType.HOUSE, "room": RoomType.ENTIRE_PLACE,
        "price": "298.00", "cleaning": "120.00",
        "guests": 6, "bedrooms": 3, "beds": 3, "baths": "2.0",
        "rating": "4.91", "reviews": 203,
        "amenities": ["wifi", "kitchen", "pool", "hot-tub", "air-conditioning", "free-parking", "bbq-grill", "ev-charger"],
        "photos": ["1600585154340-be6161a56a0c", "1580587771525-78b9dba3b914", "1600607687939-ce8a6c25118c"],
        "description": (
            "Concrete, glass and a black-bottom pool that disappears at dusk. Five minutes from "
            "the park's west entrance. On a clear night you can read by the Milky Way."
        ),
    },
    {
        "title": "Private Room in a Craftsman Home",
        "city": "Portland", "state": "Oregon", "country": "United States",
        "lat": Decimal("45.5152"), "lon": Decimal("-122.6784"),
        "type": PropertyType.HOUSE, "room": RoomType.PRIVATE_ROOM,
        "price": "78.00", "cleaning": "25.00",
        "guests": 2, "bedrooms": 1, "beds": 1, "baths": "1.0",
        "rating": "4.72", "reviews": 411,
        "amenities": ["wifi", "kitchen", "heating", "washer", "pets-allowed", "workspace"],
        "photos": ["1505873242700-f289a29e1e0f", "1522771739844-6a9f6d5f14af", "1567767292278-a4f21aa2d36e"],
        "description": (
            "A big upstairs room with its own bathroom in a 1912 craftsman. Shared kitchen, "
            "resident cat, excellent coffee. Alberta Street is a ten-minute walk."
        ),
    },
    {
        "title": "Lakefront A-Frame",
        "city": "Lake Tahoe", "state": "California", "country": "United States",
        "lat": Decimal("39.0968"), "lon": Decimal("-120.0324"),
        "type": PropertyType.CABIN, "room": RoomType.ENTIRE_PLACE,
        "price": "342.00", "cleaning": "150.00",
        "guests": 6, "bedrooms": 3, "beds": 4, "baths": "2.0",
        "rating": "4.96", "reviews": 152,
        "amenities": ["wifi", "kitchen", "fireplace", "hot-tub", "free-parking", "ski-in-out", "heating", "bbq-grill"],
        "photos": ["1449844908441-8829872d2607", "1542718610-a1d656d1884c", "1520250497591-112f2f40a3f4"],
        "description": (
            "Forty feet of private shoreline and a wall of glass facing it. Wood stove, a canoe in "
            "the boathouse, and twenty minutes to three ski resorts."
        ),
    },
    {
        "title": "Modern Condo, Downtown Skyline",
        "city": "Seattle", "state": "Washington", "country": "United States",
        "lat": Decimal("47.6062"), "lon": Decimal("-122.3321"),
        "type": PropertyType.CONDO, "room": RoomType.ENTIRE_PLACE,
        "price": "198.00", "cleaning": "70.00",
        "guests": 4, "bedrooms": 2, "beds": 2, "baths": "2.0",
        "rating": "4.81", "reviews": 97,
        "amenities": ["wifi", "kitchen", "gym", "workspace", "heating", "washer", "dryer", "ev-charger", "tv"],
        "photos": ["1545324418-cc1a3fa10c00", "1502672260266-1c1ef2d93688", "1554995207-c18c203602cb"],
        "description": (
            "Twenty-second floor, corner unit, Sound on one side and the city on the other. "
            "Building gym, secure parking, Pike Place is a fifteen-minute walk downhill."
        ),
    },
    {
        "title": "Historic Adobe near the Plaza",
        "city": "Santa Fe", "state": "New Mexico", "country": "United States",
        "lat": Decimal("35.6870"), "lon": Decimal("-105.9378"),
        "type": PropertyType.HOUSE, "room": RoomType.ENTIRE_PLACE,
        "price": "225.00", "cleaning": "90.00",
        "guests": 4, "bedrooms": 2, "beds": 3, "baths": "2.0",
        "rating": "4.89", "reviews": 168,
        "amenities": ["wifi", "kitchen", "fireplace", "heating", "air-conditioning", "free-parking", "washer"],
        "photos": ["1600607687920-4e2a09cf159d", "1600566753086-00f18fb6b3ea", "1600585154526-990dced4db0d"],
        "description": (
            "Three-foot adobe walls, two kiva fireplaces and a courtyard with an apricot tree. "
            "Six blocks from the Plaza and quiet enough to hear the acequia."
        ),
    },
    {
        "title": "Beach Bungalow, Steps from the Boardwalk",
        "city": "San Diego", "state": "California", "country": "United States",
        "lat": Decimal("32.7970"), "lon": Decimal("-117.2543"),
        "type": PropertyType.HOUSE, "room": RoomType.ENTIRE_PLACE,
        "price": "265.00", "cleaning": "100.00",
        "guests": 5, "bedrooms": 2, "beds": 3, "baths": "1.5",
        "rating": "4.83", "reviews": 231,
        "amenities": ["wifi", "kitchen", "beach-access", "free-parking", "bbq-grill", "washer", "air-conditioning"],
        "photos": ["1512917774080-9991f1c4c750", "1523217582562-09d0def993a6", "1499793983690-e29da59ef1c2"],
        "description": (
            "Mission Beach, thirty seconds to sand, with an outdoor shower that gets constant use. "
            "Two bikes and a cooler in the garage. Parking is included, which locally is a luxury."
        ),
    },
    {
        "title": "Converted Barn on a Working Farm",
        "city": "Hudson", "state": "New York", "country": "United States",
        "lat": Decimal("42.2529"), "lon": Decimal("-73.7910"),
        "type": PropertyType.HOUSE, "room": RoomType.ENTIRE_PLACE,
        "price": "312.00", "cleaning": "130.00",
        "guests": 8, "bedrooms": 4, "beds": 5, "baths": "3.0",
        "rating": "4.94", "reviews": 74,
        "amenities": ["wifi", "kitchen", "fireplace", "heating", "free-parking", "pets-allowed", "bbq-grill", "workspace"],
        "photos": ["1510798831971-661eb04b3739", "1568605114967-8130f3a36994", "1600047509807-ba8f99d2cdde"],
        "description": (
            "An 1860s dairy barn, rebuilt with the beams left where they were. Forty acres, a "
            "pond you can swim in, and eggs on the step most mornings. Hudson is ten minutes away."
        ),
    },
]


def run() -> None:
    db = SessionLocal()
    try:
        print("Clearing StayHub tables…")
        # Order matters — children before parents, or the foreign keys refuse.
        # TRUNCATE ... RESTART IDENTITY CASCADE would be one line, but it also silently empties
        # anything referencing these tables, which is exactly the kind of convenience that wipes
        # something you cared about.
        db.execute(delete(Review))
        db.execute(delete(Payment))
        db.execute(delete(Booking))
        db.execute(text("DELETE FROM property_amenities"))
        db.execute(delete(PropertyImage))
        db.execute(delete(Property))
        db.execute(delete(Amenity))
        db.execute(delete(User))
        db.commit()

        print("Amenities…")
        amenities = {}
        for slug, name, icon in AMENITIES:
            a = Amenity(slug=slug, name=name, icon=icon)
            db.add(a)
            amenities[slug] = a
        db.flush()

        print("Users…")
        admin = User(
            email="admin@stayhub.test", password_hash=hash_password("admin123"),
            first_name="Ana", last_name="Rivera", role=UserRole.ADMIN, is_host=False,
        )
        host_one = User(
            email="host@stayhub.test", password_hash=hash_password("host123"),
            first_name="Marcus", last_name="Chen", role=UserRole.CUSTOMER, is_host=True,
            host_bio="Architect by trade. I look after four places and answer messages fast.",
        )
        host_two = User(
            email="host2@stayhub.test", password_hash=hash_password("host123"),
            first_name="Priya", last_name="Nair", role=UserRole.CUSTOMER, is_host=True,
            host_bio="I grew up in these mountains and have been hosting since 2016.",
        )
        guest = User(
            email="guest@stayhub.test", password_hash=hash_password("guest123"),
            first_name="Sam", last_name="Okafor", role=UserRole.CUSTOMER, is_host=False,
        )
        db.add_all([admin, host_one, host_two, guest])
        db.flush()

        print("Listings…")
        hosts = [host_one, host_two]
        created: list[Property] = []
        for i, spec in enumerate(LISTINGS):
            prop = Property(
                host_id=hosts[i % 2].id,
                title=spec["title"],
                description=spec["description"],
                property_type=spec["type"],
                room_type=spec["room"],
                status=PropertyStatus.PUBLISHED,
                address_line1=f"{100 + i} Example Street",
                city=spec["city"], state=spec["state"], country=spec["country"],
                postal_code="00000",
                latitude=spec["lat"], longitude=spec["lon"],
                price_per_night=Decimal(spec["price"]),
                cleaning_fee=Decimal(spec["cleaning"]),
                max_guests=spec["guests"], bedrooms=spec["bedrooms"],
                beds=spec["beds"], bathrooms=Decimal(spec["baths"]),
                rating_average=Decimal(spec["rating"]), rating_count=spec["reviews"],
            )
            prop.amenities = [amenities[s] for s in spec["amenities"]]
            for order, pid in enumerate(spec["photos"]):
                prop.images.append(
                    PropertyImage(
                        url=photo(pid), alt_text=spec["title"],
                        sort_order=order, is_cover=(order == 0),
                    )
                )
            db.add(prop)
            created.append(prop)
        db.flush()

        print("A couple of bookings…")
        today = datetime.now(UTC).date()
        # One far enough out to be cancellable, one inside the 2-day window so the cancellation
        # rule is visible in the UI without editing the database by hand.
        for prop, start_in_days in ((created[0], 30), (created[3], 1)):
            check_in = today + timedelta(days=start_in_days)
            check_out = check_in + timedelta(days=3)
            b = pricing_service.quote(prop, check_in, check_out)
            db.add(
                Booking(
                    property_id=prop.id, guest_id=guest.id,
                    check_in=check_in, check_out=check_out, guests=2,
                    nights=b.nights, nightly_rate=b.nightly_rate, subtotal=b.subtotal,
                    cleaning_fee=b.cleaning_fee, service_fee=b.service_fee, total=b.total,
                    status=BookingStatus.CONFIRMED,
                )
            )
        db.commit()

        print("Building the search index…")
        indexed = indexer.rebuild_index(created)
        indexer.refresh_index()

        print()
        print(f"  {len(created)} listings · {indexed} indexed · 4 users · 2 bookings")
        print()
        print("  admin@stayhub.test / admin123   (staff)")
        print("  host@stayhub.test  / host123    (host + guest)")
        print("  guest@stayhub.test / guest123   (guest)")
    finally:
        db.close()


if __name__ == "__main__":
    run()
