const discovery = require('./app/discovery');
const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const compression = require('compression');
const repl = require('repl');

discovery.start({
  host: '0.0.0.0',
  port: 1889
});


app.use(bodyParser.json());

const {PORT = 80} = process.env

require("./app/api")(app);

app.use(compression())
app.use(express.static('build'));

console.log('listening on %s', PORT)
app.listen(PORT)


const r = repl.start('> ');
r.on('exit', () => {
  console.log('Received "exit" event from repl!');
  process.exit();
});
r.context.discoveries = discovery.discoveries;
r.context.reqire = require; 

