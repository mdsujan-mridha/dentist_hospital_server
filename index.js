const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const res = require('express/lib/response');
const port = process.env.PORT || 5000;



app.use(express.json());
app.use(cors());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ghhfp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// herify jwt function 
const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorization access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {

  try {
    await client.connect();
    const servicesCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('bookings');
    const userCollection = client.db('doctors_portal').collection('users');
    const doctorCollection = client.db('doctors_portal').collection('doctors');
    // verify admin function 
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requestAccount = await userCollection.findOne({ email: requester });
      if (requestAccount.role === 'admin') {
        next();
      }
      else {
        return res.status(403).send({ message: 'Forbidden access' });
      }

    }
    /**
     * API naming convention
     * app.get('/booking)//get all booking collection
     * app.get('/booking/:id) get specific booking
     * app.post('/booking') add new booking
     * app.patch("/booking/:id") update booking information
     * app.delete("/booking/:id") delete booking
    **/
    app.get('/service', async (req, res) => {
      const query = {}
      const cursor = servicesCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });
    //  post booking API 
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, selected: booking.selected, patientEmail: booking.patientEmail }
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }

      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });

    });
    // this is mongoDB aggregation operation 
    app.get('/available', async (req, res) => {
      const selected = req.query.selected || 'Sep 2, 2022';
      // get all services 
      const services = await servicesCollection.find().toArray();
      // get the booking of the dey 
      const query = { selected: selected };
      const bookings = await bookingCollection.find(query).toArray();
      // for each services find booking for that service 
      services.forEach(service => {
        const serviceBookings = bookings.filter(b => b.treatment === service.name);
        const booked = serviceBookings.map(s => s.getBookingTime);
        // service.booked = booked
        const available = service.slots.filter(getBookingTime => !booked.includes(getBookingTime));
        service.slots = available;
      })
      res.send(services);
    });

    // get one user booking appointment API 

    app.get('/booking', verifyJwt, async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const decodedEmail = req.decoded.email;
      if (patientEmail === decodedEmail) {
        const query = { patientEmail: patientEmail };
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      }
      else {
        return res.status(402).send({ message: 'Forbidden access' });
      }
    });
    // get single on Id for make payment API 
     app.get('/booking/:id', async(req,res) =>{
       const id = req.params.id;
       const query = {_id:ObjectId(id)};
       const booking = await bookingCollection.findOne(query);
       res.send(booking); 
     })
    // make admin API 
    app.put('/user/admin/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc,);
        res.send(result);
      }
      else {
        return res.status(412).send({ message: 'You are not admin of this site' });
      }
    });
    // get all admin role API 
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    })
    // put user on server 
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
      res.send({ result, token });
    });

    // get all user 
    app.get('/user', verifyJwt, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // add doctor API 
    app.post('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.get('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });
    // delete doctor from client site 
    app.delete('/doctor/:email',verifyJwt,verifyAdmin, async(req,res,) =>{
      const email = req.params.email;
      const filter = {email:email}
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    })
  }

  finally {

  }

}
run().catch(console.dir)





// root api 
app.get('/', (req, res) => {
  res.send('Hello From doctors portal server')
})

app.listen(port, () => {
  console.log(`Doctors portal app listening on port ${port}`)
})