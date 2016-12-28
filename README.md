# Alfresco Authentication Router

**PLEASE NOTE: This is a personal development project and is not supported in any way by Alfresco Software Ltd.**

## About
This project provides some utilities functions that can be used to set up a Node.js Express server to handle authentication against an Alfresco Repository (via Passport.js) and act as a proxy for REST calls to both the WebScript and Public APIs. The routing mirrors the proxying provided by Alfresco Share so that pages created in a Node development environment (in order to take advantage of webpack, babel, etc.) can be easily deployed as new pages in Share.

## Installation
This can be installed using npm install:

```
npm install alfresco-auth-router
```

## Exported Functions
The following functions are exported:
* isAuthenticated - a simple function for checking if the user data is available on the incoming request
* passportStrategy - a Passport.js strategy for authenticating against an Alfresco Repository
* serializeUser - a function for serializing the user data
* deserializeUser - a function for deserializing the user data
* authRoutes - Express routes for authentication
* apiRoutes - Express routes for calls to the REST APIs on the Alfresco Repository

## Usage
This package can be integrated into an Express server setup as follows.

```JAVASCRIPT
const passport = require('passport');
const alfrescoAuthRouter = require('alfresco-auth-router');

server.use(passport.initialize());
server.use(passport.session());

passport.use(alfrescoAuthRouter.passportStrategy());
passport.serializeUser(alfrescoAuthRouter.serializeUser);
passport.deserializeUser(alfrescoAuthRouter.deserializeUser);
server.use('/auth', alfrescoAuthRouter.authRoutes(passport));
server.use('/proxy', alfrescoAuthRouter.apiRoutes());
```
