const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
require("./db/connection");

const router = require('./routers/router');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(router);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
