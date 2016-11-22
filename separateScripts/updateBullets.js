/*var fs = require("fs");
var bulletTypes;

fs.readFile("../data/bulletTypes.json", function(data, err){
    if(err){
        console.error(err);
    }
    bulletTypes=JSON.parse(data);
});*/
var bulletTypes = require("./bulletTypes.js");
var server = require("../server.js");

//var server = require("../server.js");

module.exports = function() {
    var bullets = server.getBullets();
    var npcs = server.getNpcs();
    var players = server.getPlayers();
    var particles = server.getParticles();
    var map = server.getMap();
    for (var cBullet = 0; cBullet < bullets.length; cBullet++) {
        bulletTypes[bullets[cBullet].type].onTick(cBullet, bullets, players, npcs, map, particles);
    }

};
