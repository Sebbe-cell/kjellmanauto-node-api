const PORT = process.env.PORT || 8000;
const express = require("express");
const axios = require("axios");
const ftp = require("basic-ftp");
const Client = require("ssh2").Client;
const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config({ path: ".env.production" });

const app = express();

import { allowedOrigins, smartUrl } from "./variants";

app.use(
  cors({
    origin: function (origin, callback) {
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: "POST, GET, PUT",
    allowedHeaders: "Content-Type",
  })
);

app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
  host: process.env.HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

app.get("/", (req, res) => {
  res.json("Kjellman Auto API");
});

app.get("/vehicles", async (req, res) => {
  const conn = new Client();

  try {
    await new Promise((resolve, reject) => {
      conn
        .on("ready", () => {
          resolve();
        })
        .connect({
          host: process.env.SSH_HOST,
          port: process.env.SSH_PORT,
          username: process.env.SSH_USERNAME,
          password: SSH_PASSWORD,
        });
    });

    const fileName = "Vehicles.xml";
    const localFilePath = path.join(__dirname, fileName);

    const file = fs.createWriteStream(localFilePath);

    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);

        sftp.fastGet(
          smartUrl,
          localFilePath,
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    });

    const xmlData = fs.readFileSync(localFilePath, "utf-8");

    // Using a promise to handle XML-to-JSON conversion
    const parseXml = (xmlData) => {
      return new Promise((resolve, reject) => {
        const parser = new xml2js.Parser();
        parser.parseString(xmlData, (err, jsonData) => {
          if (err) {
            reject(err);
          } else {
            resolve(jsonData);
          }
        });
      });
    };

    // Handle XML-to-JSON conversion and response
    parseXml(xmlData)
      .then((jsonData) => {
        res.json(jsonData);
      })
      .catch((err) => {
        console.error(err);
        res.status(502).send("Error converting XML to JSON.");
      });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching the file.");
  } finally {
    conn.end();
  }
});

app.get("/vehicle/:id", async (req, res) => {
  const testId = req.params.id;
  const conn = new Client();

  try {
    await new Promise((resolve, reject) => {
      conn
        .on("ready", () => {
          resolve();
        })
        .connect({
          host: process.env.SSH_HOST,
          port: process.env.SSH_PORT,
          username: process.env.SSH_USERNAME,
          password: process.env.SSH_PASSWORD,
        });
    });

    const fileName = "Vehicles.xml";
    const localFilePath = path.join(__dirname, fileName);

    const file = fs.createWriteStream(localFilePath);

    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);

        sftp.fastGet(
          smartUrl,
          localFilePath,
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    });

    const xmlData = fs.readFileSync(localFilePath, "utf-8");

    const parser = new xml2js.Parser();
    parser.parseString(xmlData, (err, jsonData) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error converting XML to JSON.");
      } else {
        const tests = jsonData.vehicles.vehicle;

        const selectedTest = tests.find((test) => test.$.id === testId);

        if (selectedTest) {
          res.json(selectedTest);
        } else {
          res.status(404).send("Test not found");
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching the file.");
  } finally {
    conn.end();
  }
});

app.post("/send-email", (req, res) => {
  const { from, to, subject, text } = req.body;

  const mailOptions = {
    from,
    to,
    subject,
    text,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send("Internal Server Error");
    } else {
      console.log("Email sent: " + info.response);
      res.status(200).send("Email sent successfully");
    }
  });
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
