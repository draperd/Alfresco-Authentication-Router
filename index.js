'use strict';

const isAuthenticated = function(req, res, next) {
   if (!req.user) 
   {
      req.flash('error', 'You must be logged in.');
      return res.redirect('/');
   }
   return next();
};

// This is probably not a great way to do this, just trying to get something working...
const sessionTokens = {};

/**
 *
 * server.use('/auth', authRoutes);
 * 
 * @param {object} passport
 * @return {string}
 */
module.exports = {

   isAuthenticated: isAuthenticated,

   passportStrategy: function(config) {

      // We need passport-local as we're going to use it to construct our new authentication strategy
      const LocalStrategy = require('passport-local');

      // We need http in order to make the proxy calls to the Alfresco Repository
      const http = require('http'); 

      // Fallback for when no configuration is provided
      config = config || {};

      return new LocalStrategy((username, password, done) => {

            // Create the expected data to login to the Alfresco repository...
            var postData = JSON.stringify({
               'username': username,
               'password': password
            });

            // Set up the basic request information to login...
            var options = {
               hostname: config.repositoryDomain || 'localhost',
               port: config.repositoryPort || 8080,
               path: '/alfresco/service/api/login',
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postData)
              }
            };

            var req = http.request(options, (res) => {
               res.setEncoding('utf8');
               let rawData = '';
               res.on('data', (chunk) => {
                  rawData += chunk;
               });
               res.on('end', () => {

                  // A 200 response indicates a successful login...
                  if (res.statusCode === 200)
                  {
                     let parsedData = JSON.parse(rawData);
                     done(null, {
                        username: username,
                        ticket: parsedData.data.ticket
                     });
                  }
                  else
                  {
                     done(null, false, { message: 'Authentication failure' });
                  }
               });
            });

            req.on('error', (e) => {
               done(null, false, { message: 'Authentication failure' });
            });

            // write data to request body
            req.write(postData);
            req.end();
        }
      );
   },

   // Handle the serializing and deserializing of the user data. The key piece of information
   // is the session ticket which should be provided on login. The user data (including the 
   // all import session ticket) is currently just stored in a local object in memory (there
   // is probably a better approach for this but it works for now)...

   serializeUser: function(user, done) {
      sessionTokens[user.username] = user;
      done(null, user.username);
   },

   deserializeUser: function(username, done) {
      var user = sessionTokens[username];
      done(null, user);
   },

   authRoutes: function(passport) {

      // We need express in order to get a new router instance
      const express = require('express'); 

      // Create authentication routes
      const authRoutes = express.Router();

      authRoutes.post('/login',
        passport.authenticate('local', {
          failureRedirect: '/',
          successRedirect: '/dashboard',
          failureFlash: true,
        })
      );

      return authRoutes;
   },

   apiRoutes: function(config) {
      // We need express in order to get a new router instance
      const express = require('express');

      // We need http in order to make the proxy calls to the Alfresco Repository
      const http = require('http'); 

      // Create API routes for handling requests to the Alfresco Repository
      const apiRoutes = express.Router();

      // Fallback for when no configuration is provided...
      config = config || {};

      apiRoutes.use(isAuthenticated);

      // This is a re-usable handler function for handling proxy requests to the
      // Alfresco repository. It is passed as a callback handler to each of the standard
      // HTTP methods for the /proxy/alfresco route...
      const proxyRequestHandler = function(method, inReq, outRes) {
         // Need to handle any request parameters that are supplied appropriately...
         var delimiter = inReq.url.indexOf('?') === -1 ? '?' : '&';

         // Set up the request options (ensuring that we append the user session ticket)
         // so that the request is authenticated...
         var options = {
            hostname: config.repositoryDomain || 'localhost',
            port: config.repositoryPort || 8080,
            path: inReq.url + delimiter + 'alf_ticket=' + inReq.user.ticket,
            method: method,
            headers: {
               'Content-Type': 'application/json'
            }
         };

         // Make and handle the request
         // TODO: The error handling needs to be improved here...
         var req = http.request(options, (res) => {
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => {
               rawData += chunk;
            });
            res.on('end', () => {
               if (res.statusCode === 200)
               {
                  let parsedData = JSON.parse(rawData);
                  outRes.json(parsedData);
               }
               else
               {
                  outRes.status(res.statusCode).send(rawData);
               }
            });
         });

         req.on('error', (e) => {
            outRes.status(500).send(e);
         });

         if (inReq.body)
         {
            req.write(JSON.stringify(inReq.body));
         }
         req.end();
      };

      // Map all the standard HTTP methods here (this isn't the comprehensive set, but
      // should be sufficient for the time being)...
      apiRoutes.get('/*', (inReq, outRes) => proxyRequestHandler('GET', inReq, outRes));
      apiRoutes.post('/*', (inReq, outRes) => proxyRequestHandler('POST', inReq, outRes));
      apiRoutes.put('/*', (inReq, outRes) => proxyRequestHandler('PUT', inReq, outRes));
      apiRoutes.delete('/*', (inReq, outRes) => proxyRequestHandler('DELETE', inReq, outRes));

      return apiRoutes;
   }

};


