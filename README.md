### Introduction
An API (Application Programming Interface) for an E-commerce store plays a crucial role in enabling seamless integration between various systems and applications involved in the buying and selling of goods online. By providing a standardized method for communication and interaction, an E-commerce API simplifies the process of creating, managing, and updating product listings, inventory levels, order information, and payment processing. It allows developers to access essential functionalities of an E-commerce platform programmatically, facilitating the development of custom features and integrations tailored to specific business needs. Moreover, an E-commerce API ensures real-time synchronization of data across different channels, such as websites, mobile apps, and third-party integrations like marketplaces or social media platforms. With secure authentication mechanisms and well-documented endpoints, this robust interface empowers businesses to streamline their operations efficiently while enhancing customer experiences by offering a consistent flow of accurate information throughout the purchasing journey.

### Installation Guide
* Clone this repository [here](https://github.com/Thabiso-007/api.express-store.git).
* The develop branch is the most stable branch at any given time, ensure you're working from it.
* Run npm install to install all dependencies
* You can either work with the default mLab database or use your locally installed MongoDB. Do configure to your choice in the application entry file.
* Create an .env file in your project root folder and add your variables. See .env.sample for assistance.

### .env

In the context of software development, the object { key: value } can commonly be found in the config/env/index.js file. This file serves as a configuration file, allowing developers to define various environment-specific settings for their application. The object follows a key-value pair structure, where each key represents a specific configuration setting and the corresponding value defines its value. These values can be customized according to the needs of the application, such as defining database connection details, API endpoints, or logging parameters. By centralizing these configurations in one file, it becomes easier to manage and modify them based on different deployment environments like development, staging, or production. The use of this object facilitates flexibility and reusability within the codebase by abstracting away environment-specific details from actual application logic.

* PORT 
* MONGO_URI
* JWT_SECRET 
* EMAIL_ADDRESS 
* EMAIL_PASSWORD  
* CLOUD_NAME
* CLOUD_API_KEY 
* CLOUD_API_SECRET 
* PAYPAL_CLIENT_SECRET
* PAYPAL_CLIENT_ID

### Usage
* Run npm install to install all the dependencies
* Run ``npm start`` to run the project.
* Connect to the API using Postman.

### API Endpoints

* APIs dedicated to handling user.

|HTTP Verbs|            Endpoints            |                    Action                                     |    Superuser    |
| ---------| ------------------------------- | ------------------------------------------------------------- | --------------- |  
|  POST    | /api/user/register              | Create a brand-new user registration.                         |      user       |
|  POST    | /api/user/login                 | Logging in to an account that already exists.                 |      user       |
|  POST    | /api/user/admin-login           | To access the account of an already registered administrator  |      user       |
|  POST    | /api/user/cart                  | In order to construct a cart.                                 |      user       |
|  POST    | /api/user/forgot-password-token | To craft a token that can be used to recover a lost password. |      user       | 
|  POST    | /api/user/cart/apply-coupon     | To redeem a coupon within a designated shopping cart.         |      user       |
|  POST    | /api/user/cart/cash-order       | To generate an order                                          |      user       |
|  GET     | /api/user/refresh               | Acquires a renewed token.                                     |      user       |
|  GET     | /api/user/logout                | The system logs out a user.                                   |      user       |
|  GET     | /api/user/cart                  | Retrieves cart                                                |      user       |
|  GET     | /api/user/wishlist              | Retrieves wish list                                           |      user       |
|  GET     | /api/user/get-orders            | Retrieves orders                                              |      user       |
|  GET     | /api/user/:id                   | Retrieves a single user                                       |      user       |
|  PUT     | /api/user/order/update-order/:id| Modifying the users order status update.                      |      admin      |
|  PUT     | /api/user/reset-password/:token | Edits a password                                              |      user       |
|  PUT     | /api/user/save-address          | Address preservation.                                         |      user       |
|  PUT     | /api/user/update-password       | Modifies a users password.                                    |      user       |
|  PUT     | /api/user/update-user           | Edit user information                                         |      user       |
|  PUT     | /api/user/blocked-user/:id      | Prevents a user from accessing.                               |      admin      |
|  PUT     | /api/user/unblocked-user/:id    | Provides the option to reverse blocking for a user.           |      admin      |
|  DELETE  | /api/user/empty-cart            | Erase the shopping cart. (Empty cart)                         |      user       |
|  DELETE  | /api/user/:id                   | Remove a sole user.                                           |      admin      |


* APIs dedicated to handling products.

|HTTP Verbs|            Endpoints            |                   Action                        |   Superuser |
| ---------| ------------------------------- | ----------------------------------------------- | ----------- |
|  POST    | /api/product/create             | Generates a new item.                           |    admin    |  
|  GET     | /api/product/:id                | Retrieve one item.                              |    admin    |
|  GET     | /api/product/                   | Retrieves every user product                    |    user     |
|  PUT     | /api/product/wishlist           | Edit wish list                                  |    user     |
|  PUT     | /api/product/rating             | Rating of the product                           |    user     |
|  PUT     | /api/product/:id                | Refresh product information.                    |    admin    |
|  PUT     | /api/product/uploads/:id        | Submit a collection of product images.          |    admin    |
|  DELETE  | /api/product/:id'               | Remove a product                                |    admin    |


* APIs dedicated to handling coupon.

|HTTP Verbs|            Endpoints            |                   Action                        |   Superuser   |
| ---------| ------------------------------- | ----------------------------------------------- | ------------- |
|  POST    | /api/coupont/create             | Generates a new coupon.                         |   admin       |
|  GET     | /api/coupon/                    | Retrieves all coupons                           |   user        |
|  PUT     | /api/coupon/:id                 | Modifies a coupon                               |   admin       |
|  DELETE  | /api/coupon/:id                 | Remove a coupon                                 |   admin       |


* APIs dedicated to handling category.

|HTTP Verbs|            Endpoints            |                   Action                        |   Superuser   |
| ---------| ------------------------------- | ----------------------------------------------- | ------------- |
|  POST    | /api/category/create            | Generates a category                            |     admin     |
|  GET     | /api/category/all               | Retrieves all categories                        |     user      |
|  GET     | /api/category/:id               | Retrieves a signle category                     |     user      |
|  PUT     | /api/category/:id               | Modifies a category                             |     admin     |
|  DELETE  | /api/category/:id               | Removes a category                              |     admin     |


* APIs dedicated to handling brand.

|HTTP Verbs|            Endpoints            |                   Action                        |    Superuser  |
| ---------| ------------------------------- | ----------------------------------------------- | ------------- |
|  POST    | /api/brand/create               | Generates a brand                               |    admin      |
|  GET     | /api/brand/all                  | Retrieves all brands                            |    user       |
|  GET     | /api/brand/:id                  | Retrieves a signle brand                        |    user       |
|  PUT     | /api/brand/:id                  | Modifies a brand                                |    admin      |
|  DELETE  | /api/brand/:id                  | Removes a brand                                 |    admin      |

* APIs dedicated to handling blog

|HTTP Verbs|            Endpoints            |                   Action                        |    Superuser   |
| ---------| ------------------------------- | ----------------------------------------------- | -------------- |
|  POST    | /api/blog/create                | Generates a blog                                |     admin      |
|  GET     | /api/blog/                      | Retrives all blogs                              |     user       |
|  GET     | /api/blog/:id                   | Retrives a signle blog                          |     user       |
|  PUT     | /api/blog/likes                 | Likes a blog                                    |     admin      |
|  PUT     | /api/blog/dislikes              | Dislikes a blog                                 |     admin      |
|  PUT     | /api/blog/uploads/:id           | Submit a collection of blog images.             |     admin      |
|  PUT     | /api/blog/:id                   | Modifies a blog                                 |     admin      |
|  DELETE  | /api/blog/:id                   | Removes a blog                                  |     admin      |

* APIs dedicated to handling block category

|HTTP Verbs|            Endpoints            |                   Action                        |    Superuser   |
| ---------| ------------------------------- | ----------------------------------------------- | -------------- |
|  POST    | /api/blog/category/create       | Generates a blog category                       |     admin      |
|  GET     | /api/blog/category/             | Retrieves all blog categories                   |     user       |
|  GET     | /api/blog/category/:id          | Retrieves a signle blog category                |     user       |
|  PUT     | /api/blog/category/likes        | Likes a blog category                           |     admin      |
|  DELETE  | /api/blog/category/:id          | Removes a blog category                         |     admin      |

* APIs dedicated to handling colors.

|HTTP Verbs|            Endpoints            |                   Action                        |    Superuser   |
| ---------| ------------------------------- | ----------------------------------------------- | -------------- |
|  POST    | /api/color/                     | Generates a blog category                       |     admin      |
|  GET     | /api/color/:id                  | Retrieves all blog categories                   |     user       |
|  GET     | /api/color/                     | Retrieves a signle blog category                |     user       |
|  PUT     | /api/color/:id                  | Likes a blog category                           |     admin      |
|  DELETE  | /api/color/:id                  | Removes a blog category                         |     admin      |


* APIs dedicated to handling inquiries.

|HTTP Verbs|            Endpoints            |                   Action                        |     Superuser   |
| ---------| ------------------------------- | ----------------------------------------------- | --------------- |
|  POST    | /api/enquiry/                   | Generates a blog category                       |     admin       |
|  GET     | /api/enquiry/:id                | Retrieves all blog categories                   |     user        |
|  GET     | /api/enquiry/                   | Retrieves a signle blog category                |     user        |
|  PUT     | /api/enquiry/:id                | Likes a blog category                           |     admin       |
|  DELETE  | /api/enquiry/:id                | Removes a blog category                         |     admin       |


### Technologies Used
* [NodeJS](https://nodejs.org/) This is a cross-platform runtime environment built on Chrome's V8 JavaScript engine used in running JavaScript codes on the server. It allows for installation and managing of dependencies and communication with databases.
* [ExpressJS](https://www.expresjs.org/) This is a NodeJS web application framework.
* [MongoDB](https://www.mongodb.com/) This is a free open source NOSQL document database with scalability and flexibility. Data are stored in flexible JSON-like documents.
* [PayPal](https://developer.paypal.com/docs/api/payments/v1/) PayPal is an online payment system that makes paying for things online and sending and receiving money safe and secure. When you link your bank account, credit card or debit card to your PayPal account, you can use PayPal to make purchases online with participating stores.
* [Cloudinary](https://cloudinary.com/) Cloudinary is an end-to-end image- and video-management solution for websites and mobile apps, covering everything from image and video uploads, storage, manipulations, optimizations to delivery.