# Stay Hub

## About
- StayHub is an app like Air BnB for short-term rentals.
- People or customers can go on this app and reserve a stay at a place.

## Requirements
- Behave and look like Air BnB(https://www.airbnb.com) but not the logo or styling.
- use react for the frontend with Tailwind CSS.
- Use one backend project to serve both, use fastapi as a framework(all create,update,delete should be served from this backend project). Use sqlalchemy with fastapi. Make sure to use professional code structure to keep classes in different layers of the project.
- Use hasura as a graphsql(all reads should come from hasura)
- Use postgres as the database.
- Customers must be able to sign up and sign in, view a house and make a booking, pay for it.
- Customers must be able to cancel a booking all the way up to 2 days before start date.
- Hosts must be able to sign up and sign in, add a house to show
- Use elasticsearch and sink data from postgres for just the houses so searching is fast. Do this sync in the code.
- User docker composer for services needed. Change port if already taken