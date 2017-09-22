'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;

const notFoundResponse = function(callback) {
  callback(null, {
    statusCode: '404',
    headers: {},
    body: ''
  });
}

exports.handler = function(event, context, callback) {
  const key = event.queryStringParameters.key;
  const match = key.match(/^resize\/(\d+)x(\d+)\/(.*)/);
  if (!match) {
    return notFoundResponse(callback);
  }

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  const filename = match[3];
  const originalKey = `original/${filename}`;

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .toFormat('png')
      .toBuffer()
    )
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: 'image/png',
        Key: key,
        StorageClass: "REDUCED_REDUNDANCY",
        CacheControl: "max-age=31536000, public",
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${key}`},
        body: '',
      })
    )
    .catch(err => {
      if (err.code === "NoSuchKey") {
        return notFoundResponse(callback);
      }
      callback(err);
    });
}
