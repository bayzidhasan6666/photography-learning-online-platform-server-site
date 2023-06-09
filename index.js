const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// json web token

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

// mongodb----------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g4e8qzr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // -----------------------------------------------------
    const usersCollection = client.db('visualDb').collection('users');
    const classCollection = client.db('visualDb').collection('classes');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: '30d',
      });

      res.send({ token });
    });

    // const verifyAdmin = async (req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   if (user?.role !== 'admin') {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: 'forbidden message' });
    //   }
    //   next();
    // };

    // ---------------users related api

    // get users from database
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // // classes related api

    app.get('/classes', async (req, res) => {
      const classes = await classCollection.find({}).toArray();
      res.send(classes);
    });

    // -----------------------------------------------------

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Visual Learning Is running....');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
