const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// JSON web token
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: 'Unauthorized access' });
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g4e8qzr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useUnifiedTopology: true });

async function run() {
  try {
    // Connect to the MongoDB server
    await client.connect();

    // Get reference to the "users" and "classes" collections
    const usersCollection = client.db('visualDb').collection('users');
    const classCollection = client.db('visualDb').collection('classes');
    const paymentCollection = client.db('visualDb').collection('payments');
    const selectedClassCollection = client
      .db('visualDb')
      .collection('selectedClasses');

    // Generate JWT token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: '30d',
      });

      res.send({ token });
    });

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res
          .status(403)
          .send({ error: true, message: 'forbidden message' });
      }
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res
          .status(403)
          .send({ error: true, message: 'forbidden message' });
      }
      next();
    };

    // Get all users
    app.get(
      '/users',

      async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      }
    );

    // Create a new user
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists' });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Check if user is an instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };
      res.send(result);
    });

    // Update user role to instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor',
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Check if user is an admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      res.send(result);
    });

    // Update user role to admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin',
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a user
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ message: 'User deleted successfully' });
        } else {
          res.send({ message: 'User not found' });
        }
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: true, message: 'Internal Server Error' });
      }
    });

    // Get all classes
    app.get('/classes', async (req, res) => {
      const classes = await classCollection.find({}).toArray();
      res.send(classes);
    });

    // Create a new class
    app.post('/classes', async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    // Update a class
    app.patch('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: req.body,
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Assuming you're using Express.js
    app.put('/classes/:id', (req, res) => {
      const classId = req.params.id;
      const updatedClass = req.body;

      // Update the class details in your database or data source
      // Here, you can use your preferred method to update the class
      // For example, if you're using MongoDB with Mongoose, it would look like:
      classCollection.findByIdAndUpdate(classId, updatedClass, { new: true })
        .then((updatedClass) => {
          res.status(200).json(updatedClass);
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: 'Failed to update class details.' });
        });
    });

    // Delete a class
    app.delete('/classes/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const result = await classCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ message: 'Class deleted successfully' });
        } else {
          res.send({ message: 'Class not found' });
        }
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: true, message: 'Internal Server Error' });
      }
    });

    // ------------manage allClasses by admin

    // Approve a class
    app.patch('/classes/:id/approve', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: 'approved' },
      };

      try {
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: true, message: 'Internal Server Error' });
      }
    });

    // Deny a class
    app.patch('/classes/:id/deny', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: 'denied' },
      };

      try {
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: true, message: 'Internal Server Error' });
      }
    });

    // Send feedback for a class
    app.patch('/classes/:id/feedback', async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { feedback },
      };

      try {
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: true, message: 'Internal Server Error' });
      }
    });

    // Selected Class Collection-------------
    app.post('/selectedClass', async (req, res) => {
      const cart = req.body;
      console.log(cart);
      const result = await selectedClassCollection.insertOne(cart);
      res.send(result);
    });

    // get  Selected Classes by Email -------------
    app.get('/selectedClass', async (req, res) => {
      try {
        const { selectedEmail } = req.query;

        const selectedClasses = await selectedClassCollection
          .find({ selectedEmail: selectedEmail })
          .toArray();

        res.send(selectedClasses);
      } catch (error) {
        console.error(error);
        res.status(500).send('Error occurred while fetching selected classes');
      }
    });

    app.get('/selectedClass/:id', async (req, res) => {
      const { id } = req.params;

      try {
        const selectedClass = await selectedClassCollection.findOne({
          _id: new ObjectId(id),
        });

        if (selectedClass) {
          res.json(selectedClass);
        } else {
          res.status(404).json({ error: 'Selected class not found' });
        }
      } catch (error) {
        console.error('Error retrieving selected class:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // DELETE endpoint to remove a selected class
    app.delete('/selectedClass/:id', async (req, res) => {
      const classId = req.params.id;

      try {
        const result = await selectedClassCollection.deleteOne({
          _id: new ObjectId(classId),
        });
        if (result.deletedCount === 1) {
          res.status(200).send('Selected class deleted successfully');
        } else {
          res.status(404).send('Selected class not found');
        }
      } catch (error) {
        console.error('Error deleting selected class', error);
        res.status(500).send('Error deleting selected class');
      }
    });

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment collection

    app.get('/payments', async (req, res) => {
      const payments = await paymentCollection.find({}).toArray();
      res.send(payments);
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    // Root URL handler
    app.get('/', (req, res) => {
      res.send('Welcome to Visual Learning.........');
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

run().catch(console.dir);
