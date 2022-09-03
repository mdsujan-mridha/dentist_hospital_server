const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;



app.use(express.json());
app.use(cors());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ghhfp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {

  try {
    await client.connect();
    const servicesCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('bookings');
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
      const cursor = servicesCollection.find(query);
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

    app.get('/booking', async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const query = { patientEmail:patientEmail};
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });
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