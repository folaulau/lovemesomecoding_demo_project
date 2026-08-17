# Pizza

## Requirements
- This app must behave and look like https://www.pizzahut.com
- Use pizza-react-frontend and pizza-angular-frontend should look like www.pizzahut.com.
- Keep this app with minimum features. 
- Users should be able to login and order and pay for the order. Use Stripe for payment.
- Users can also check out as a guest and does not have to login.
- Users should be able to buy pizza with toppings and drinks and that is it. keep products at minimum.
- Users should be able to have the option to save card for future use
- Add admin dashboard so admin users can add pizza, toppings and drinks to the menu.
- Add admin report dashboard so we can run reports

## Frontend
- start with pizza-react-frontend and use Bootstrap 5
- make sure to have a use case where it is using react context
- use the react framework
- use react major features and add comments so they are understood what they are used for.
- implement pizza-angular-frontend and use tailwind css.

## Backend
- use pizza-springboot-backend
- use Java 21 and Springboot
- use entity layout like product should have Product.java(entity class), ProductDAO, ProductDAOImp, ProductRepository, ProductService, ProductServiceImpl, ProductRestController, ... all in one package.
- use mapstruct for dto mapping
- use swagger
- use MySQL as the database.
- use localhost database for now, username: root, password:
- Stripe keys
a. Publishable key
pk_test_51U5Wc3BeMrxmFducR7hlZ3YwT770EF2DFj8VPmEmqZ7r2sVasfWDRjWMQBvEqdWOSuIGg6RSd8oIcjQ9RblgJxRq00ThBQPY9F

b. Secret key
sk_test_51U5Wc3BeMrxmFducTHj1nBq34oFWbVXEEdbMgY8YMufv5FoZitr84A42bbmgCNXfTUL0QS8Xg532ifiEWHzSBI8y00SE87Njv0
- pattern backend like this project /Users/folaukaveinga/Github/trademachine, don't worry about the frontend directory in this directory.

- add cart to the backend, when refreshing any page, cart content should be persisted in the backend.

## Test
- Use playwright and test all flows through the UI.
- Users select pizza, drinks, and place an order.
- Users for payment put in 4242 4242 4242 4242 card from Stripe test cards.
- Users should be able to have the option to save card for future use