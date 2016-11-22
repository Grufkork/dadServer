var mapName = "map.json";
//process.env.OPENSHIFT_NODEJS_PORT ||process.env.PORT || 
const PORT = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;
const IP = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '0.0.0.0';

function getDate() {
    var date = new Date();

    var day = date.getDate();
    var month = date.getMonth();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();

    if (date.getDate() < 10) {
        day = "0" + date.getDate();
    }
    if (date.getMonth() < 10) {
        month = "0" + date.getMonth();
    }
    if (date.getHours() < 10) {
        hours = "0" + date.getHours();
    }
    if (date.getMinutes() < 10) {
        minutes = "0" + date.getMinutes();
    }
    if (date.getSeconds() < 10) {
        seconds = "0" + date.getSeconds();
    }
    return day + "/" + month + "-" + hours + ":" + minutes + ":" + seconds;
}



console.log(getDate() + " " + "Server starting...");

const http = require("http"),
    sio = require("socket.io"),
    fs = require("fs"),
    sioClient = require("socket.io-client"),
    updateBullets = require("./separateScripts/updateBullets.js"),
    calcDistance = require("./separateScripts/calculateDistance.js"),
    bulletTypes = require("./separateScripts/bulletTypes.js");


var maxNpcs = 20;
var bulletSpeed = 20;
var life = 1000;
var maxHealth = 100;
var map;
//var users;
var mapFile;
var canvasSizeX;
var canvasSizeY;
var gravity;
var jumpStrength;
var leftRightMovementSpeed;
var chatMessages = [];
var maxChatMessages = 10;

var npcs = [];
var npc = function(type, health, x, y, speed) {
    this.type = type;
    this.hp = health;
    this.x = x;
    this.y = y;
    this.ySpeed = 0;
    this.canJump = true;
    this.timeSinceAttack = 0;
    this.speed = speed;
    this.stunned = 0;
    //this.target="";
};

var weapons = {
    shotgun: {
        fireRate: 20,
        spread: 0.2,
        bullets: 60,
        bulletSpeedVariation: 5,
        damage: 2
    },
    rpg: {
        fireRate: 50,
        bulletsAtExplosion: 70,
        bulletSpeed: 20,
        explosionRadius: 100,
        explosionDamage: 1000
    },
    smg: {
        fireRate: 2
    },
    grenade: {
        bounciness: 0.7,
        fireRate: 50,
        explosionDelay: 100,
        throwSthrength: 25,
        explosionRadius: 100,
        explosionDamage: 200,
        particleLingerTime: 20
    },
    sniperRifle: {
        damage: 80,
        fireRate: 20,
        bulletSpeed: 150
    },
    taser: {
        fireRate: 10,
        bulletSpeed: 70,
        stunTime: 100,
        zombieStunTime: 200,
        taseDelay: -40
    },
    pistol: {
        damage: 10
    },
    zombie: {
        damage: 10
    },
    shockGrenade: {
        bounciness: 0.7,
        fireRate: 50,
        explosionDelay: 100,
        throwSthrength: 25,
        explosionRadius: 60,
        stunTime: 40,
        particleLingerTime: 20,
        zombieStunTime: 200
    },
    c4: {
        fireRate: 30
    }
};
var particles = [];

function particle(x, y, xs, ys, type, life, color) {
    this.x = x;
    this.y = y;
    this.xs = xs;
    this.ys = ys;
    this.type = type;
    this.life = life;
    this.color = color;
}
/*console.log(getDate() + " " + "Reading users.json...");
fs.readFile("users.json", function(err, data) {
    if(err){
        return console.error(getDate() + " " + err);
    }
    console.log(getDate() + " " + "users.json read successfully, parsing and creating array...");
    users = JSON.parse(data).users;
    console.log(getDate() + " " + "users.json parsed and array created");
    readMapFile();
});*/

function generateMap() {
    var blockObj = function(type, variant, otherData) {
        this.type = type;
        this.variant = variant;
        this.otherData = otherData;
    };
    var map = {
        ySize: 50,
        xSize: 400,
        gravity: 1,
        jumpStrength: 15,
        leftRightMovementSpeed: 10,
        map
    };
    var array = [];
    for (var y = 0; y < map.ySize; y++) {
        var arrayToPush = [];
        for (var x = 0; x < map.xSize; x++) {
            arrayToPush.push(new blockObj("air"));
        }
        array.push(arrayToPush);
    }
    map.map = array;
    fs.writeFile("../" + mapName, JSON.stringify(map));
    console.log(getDate() + " Map generated");
    readMapFile();
}

readMapFile();

function readMapFile() {
    console.log(getDate() + " " + "Reading map.json...");
    fs.readFile("../" + mapName, function(err, data) {
        if (err) {
            console.error(getDate() + " ERROR: Map not found. Generating map...");
            return generateMap();
        }
        console.log(getDate() + " Map read successfully");
        console.log(getDate() + " " + "Creating map array...");
        mapFile = JSON.parse(data);
        if (mapFile.map == undefined) {
            console.error(getDate() + " " + "map.json does not contain map array");
        }
        else {
            map = mapFile.map;
            canvasSizeX = mapFile.xSize * 20;
            canvasSizeY = mapFile.ySize * 20;
            jumpStrength = mapFile.jumpStrength;
            gravity = mapFile.gravity;
            leftRightMovementSpeed = mapFile.leftRightMovementSpeed;
        }
        console.log(getDate() + " " + "Map array created");
        doEverything();
    });
}

function doEverything() {
    console.log(getDate() + " " + "Starting server...");
    // create http server
    var server = http.createServer();
    server.listen(PORT, IP);
    console.log(getDate() + " " + "Server listening on " + IP + ":" + PORT);
    var io = sio.listen(server);



    console.log(getDate() + " " + "Server initiated, now accepting connections");
    var text = "";
    for (var x = 0; x < process.stdout.columns; x++) {
        text = text + "-";
    }
    console.log(text);

    var players = [];
    var bullets = [];

    /*var blocks = {
        grass:{
            blocksBullets:true
        },
        platform:{
            blocksBullets:false
        },
        glass:{
            blocksBullets:true,
            onBulletHit:function(position){
                map[position.y][position.x].type="air";
                io.sockets.emit("map", {map:map});
            }
        },
        reinforcedGlass:{
            blocksBullets:true,
            onBulletHit:function(position){
                if(map[position.y][position.x].variant==0){
                    map[position.y][position.x].variant=1;
                }else if(map[position.y][position.x].variant==1){
                    map[position.y][position.x].variant=2;
                }else if(map[position.y][position.x].variant==2){
                    map[position.y][position.x].type="air";
                }
                io.sockets.emit("map", {map:map});
            }
        },
        net:{
            blocksBullets:false
        },
        door:{
            blocksBullets:true
        }
    };*/

    /*
    var basicBullet = {
        prototype:function(dmg, x, y, xs, ys){
            this.dmg=dmg;
            this.x=x;
            this.y=y;
            this.xs=xs;
            this.ys=ys;
            this.shallSplice=false;
            this.origin="basicBullet";
        },
        onPlayerHit:function(playerIndex, bulletIndex){
            players[playerIndex].hp-=bullets[bulletIndex].dmg;
            bullets[bulletIndex].shallSplice=true;
        },
        onNpcHit:function(npcIndex, bulletIndex){
            npcs[npcIndex].hp-=bullets[bulletIndex].dmg;
            bullets[bulletIndex].shallSplice=true;
        },
        onBlockHit:function(bulletIndex, coords, block){
            if(blocks[block.type].blocksBullets){
                bullets[bulletIndex].shallSplice=true;
            }
            if(blocks[block.type].onBulletHit!=undefined){
                blocks[block.type].onBulletHit(new Coordinate(Math.floor(coords.y/20),Math.floor(coords.x/20)));
            }
        },
        onEdgeHit:function(bulletIndex){
            bullets[bulletIndex].shallSplice=true;
        }
    };

    var rocketGrenade = {
        prototype:function(x, y, xs, ys){
            this.x=x;
            this.y=y;
            this.xs=xs;
            this.ys=ys;
            this.shallSplice=false;
            this.origin="rocketGrenade";
        },
        onPlayerHit:function(playerIndex, bulletIndex){
            explode(bullets[bulletIndex].x, bullets[bulletIndex].y, weapons.rpg.explosionDamage, weapons.rpg.explosionRadius);
            bullets[bulletIndex].shallSplice=true;
        },
        onNpcHit:function(npcIndex, bulletIndex){
            explode(bullets[bulletIndex].x, bullets[bulletIndex].y, weapons.rpg.explosionDamage, weapons.rpg.explosionRadius);
            bullets[bulletIndex].shallSplice=true;
        },
        onBlockHit:function(bulletIndex, coords, block){
            if(blocks[block.type].blocksBullets){
                explode(bullets[bulletIndex].x, bullets[bulletIndex].y, weapons.rpg.explosionDamage, weapons.rpg.explosionRadius);
                bullets[bulletIndex].shallSplice=true;
            }
        },
        onEdgeHit:function(bulletIndex){
            explode(bullets[bulletIndex].x, bullets[bulletIndex].y, weapons.rpg.explosionDamage, weapons.rpg.explosionRadius);
            bullets[bulletIndex].shallSplice=true;
        }
    };
    var grenade = {
        prototype:function(x, y, xs, ys){
            this.x=x;
            this.y=y;
            this.xs=xs;
            this.ys=ys;
            this.shallSplice=false;
            this.origin="grenade";
        },
        onPlayerHit:function(playerIndex, bulletIndex){},
        onNpcHit:function(npcIndex, bulletIndex){},
        onBlockHit:function(bulletIndex, coords, block){
            if(block.type!="net"&&block.type!="platform"){
                
            }
        },
        onEdgeHit:function(bulletIndex){
            if(bullets[bulletIndex].x<0||bullets[bulletIndex].x>map[0].length*20){
                bullets[bulletIndex].xs*=-1;
            }
            if(bullets[bulletIndex].y<0||bullets[bulletIndex].y>map.length*20){
                bullets[bulletIndex].ys*=-1;
            }
        },
        onSpacePress:function(bulletIndex){
            explode(bullets[bulletIndex].x, bullets[bulletIndex].y, weapons.grenade.explosionDamage, weapons.grenade.explosionRadius);
            bullets[bulletIndex].shallSplice=true;
        }
    };


    var bullet=function(x, y, xs, ys, type, life, sender, data){
    	this.y=y;
    	this.x=x;
    	this.xs=xs;
    	this.ys=ys;
    	this.type=type;
    	this.life=life;
    	this.sender=sender;
    	this.data=data;
    };

    */

    function addParticle(newParticle) {
        particles.push(newParticle);
        io.sockets.emit("newParticle", {
            p: newParticle
        });
    }

    var healthRegenTime = 200;
    var healthRegenRate = 1;

    function explode(x, y, explosionDamage, explosionRadius) {
        for (var currPlayer = 0; currPlayer < players.length; currPlayer++) {
            if (calcDistance(x, y, players[currPlayer].x + 10, players[currPlayer].y + 10) <= explosionRadius + 10 && players[currPlayer].creativeMode == false) {
                players[currPlayer].hp -= Math.round((explosionDamage / explosionRadius) * (explosionRadius - calcDistance(x, y, players[currPlayer].x + 10, players[currPlayer].y + 10)));
                players[currPlayer].timeUntilHealthRegen = healthRegenTime;
            }
        }
        for (var currNpc = 0; currNpc < npcs.length; currNpc++) {
            if (calcDistance(x, y, npcs[currNpc].x + 10, npcs[currNpc].y + 10) <= explosionRadius + 10) {
                npcs[currNpc].hp -= Math.round((explosionDamage / explosionRadius) * (explosionRadius - calcDistance(x, y, npcs[currNpc].x + 10, npcs[currNpc].y + 10)));
            }
        }
        addParticle(new particle(x, y, explosionRadius, 20, 5, 20));
    }

    var zombieJumpHeight = -10;

    /*function generateMap(){
        for(var y = 0; y < canvasSizeY/20; y++){
            var arrayToPush=[];
            for(var x = 0; x < canvasSizeX/20; x++){
                arrayToPush.push(0);
            }
            map.push(arrayToPush);
        }
    }
    generateMap();*/



    function getIndexFromId(id) {
        for (var x = 0; x < players.length; x++) {
            if (players[x].id == id) {
                return x;
            }
        }
    }

    /*function getAdminIndexFromId (id){
      for(var x = 0; x < admins.length; x++){
        if(admins[x].id == id){
          return x;
        }
      }
    }*/

    var centralServerAddress = "http://139.59.209.179:8081";

    var admins = [];

    //Exports
    module.exports.writeMap = function(editedMap) {
        map = editedMap;
        io.sockets.emit("map", {
            map: map
        });
    };
    module.exports.getMap = function() {
        return map;
    };
    module.exports.createExplosion = function(x, y, explosionDamage, explosionRadius) {
        for (var currPlayer = 0; currPlayer < players.length; currPlayer++) {
            if (calcDistance(x, y, players[currPlayer].x + 10, players[currPlayer].y + 10) <= explosionRadius + 10 && players[currPlayer].creativeMode == false) {
                players[currPlayer].hp -= Math.round((explosionDamage / explosionRadius) * (explosionRadius - calcDistance(x, y, players[currPlayer].x + 10, players[currPlayer].y + 10)));
                players[currPlayer].timeUntilHealthRegen = healthRegenTime;
            }
        }
        for (var currNpc = 0; currNpc < npcs.length; currNpc++) {
            if (calcDistance(x, y, npcs[currNpc].x + 10, npcs[currNpc].y + 10) <= explosionRadius + 10) {
                npcs[currNpc].hp -= Math.round((explosionDamage / explosionRadius) * (explosionRadius - calcDistance(x, y, npcs[currNpc].x + 10, npcs[currNpc].y + 10)));
            }
        }
        addParticle(new particle(x, y, explosionRadius, 20, 5, 20));
    };
    module.exports.getBullets = function() {
        return bullets;
    };
    module.exports.writeBullets = function(data) {
        bullets = data;
    };
    module.exports.getNpcs = function() {
        return npcs;
    };
    module.exports.writeNpcs = function(data) {
        npcs = data
    };
    module.exports.getPlayers = function() {
        return players;
    };
    module.exports.writePlayers = function(data) {
        players = data;
    };
    module.exports.getParticles = function() {
        return particles;
    };
    module.exports.writeParticles = function(data) {
        particles = data;
    };
    module.exports.addParticle = function(newParticle) {
        particles.push(newParticle);
        io.sockets.emit("newParticle", {
            p: newParticle
        });
    };

    io.sockets.on('connection', function(socket) {
        /*socket.on("adminLogin", function(data){
            console.log("adminLoginAttempted");
            var shallDisconnect=true;
            for(var x = 0; x < users.length; x++){
                
                if(data.name.toLowerCase()==users[x].name){
                    console.log("namePassed");
                    
                    if(data.password==users[x].password){
                        console.log("passwordPassed");
                        
                        if(users[x].admin==true){
                            shallDisconnect=false;
                            x=users.length;
                            console.log("adminPassed");
                            socket.emit("connected");
                            admins.push({id:socket.id});
                            socket.on("addUser", function(data){
                                var usersToPush = users;
                                usersToPush.push({name:data.name, password:data.password, admin:false});
                                usersToPush={users:usersToPush};
                                fs.writeFile("users.json", JSON.stringify(usersToPush));
                                socket.emit("userAdded");
                                
                            });
                            socket.on("getPlayers", function(data){
                                socket.emit("players", {players:players});
                            });
                        }
                    }
                }
            }
            if(shallDisconnect){
                socket.emit("loginFailure");socket.disconnect();
            }
        });*/
        socket.on("login", function(data) {
            var authSocket = sioClient.connect(centralServerAddress);
            authSocket.on("connect", function() {
                authSocket.emit("checkKey", {
                    key: data.key
                });
                authSocket.on("keyOk", function(data) {
                    players.push({
                        id: socket.id,
                        x: 0,
                        y: 0,
                        keys: {
                            up: false,
                            down: false,
                            left: false,
                            right: false,
                            space: false
                        },
                        selectedWeapon: 0,
                        ySpeed: 0,
                        hasJumped: false,
                        messages: [],
                        name: data.name,
                        hp: maxHealth,
                        weapons: {
                            shotgun: {
                                timeSinceFired: 0
                            },
                            smg: {
                                timeSinceFired: 0
                            },
                            rpg: {
                                timeSinceFired: 0
                            },
                            grenade: {
                                timeSinceFired: 0
                            },
                            sniperRifle: {
                                timeSinceFired: 0
                            },
                            taser: {
                                timeSinceFired: 0
                            },
                            shockGrenade: {
                                timeSinceFired: 0
                            },
                            c4: {
                                timeSinceFired: 0
                            }

                        },
                        dead: false,
                        shallBeKicked: false,
                        kickReason: "",
                        aimingAt: {
                            x: 0,
                            y: 0
                        },
                        stunned: 1,
                        creativeMode: false,
                        timeSinceSwitch: 0,
                        timeUntilHealthRegen: 0
                    });
                    socket.on("disconnectionRequest", function() {
                        socket.emit("disconnectionConfirmed");
                        socket.disconnect();
                    });
                    socket.emit("nowConnected", {
                        id: socket.id,
                        canvasSizeX: canvasSizeX,
                        canvasSizeY: canvasSizeY,
                        hp: 10
                    });
                    console.log(getDate() + " " + data.name + " connected");
                    connected();
                });
            });
        });

        function connected() {

            io.sockets.emit("map", {
                map: map
            });
            var id = socket.id;
            //function keyHandler(){
            socket.on("up_press", function() {
                players[getIndexFromId(socket.id)].keys.up = true;
            });
            socket.on("down_press", function() {
                players[getIndexFromId(socket.id)].keys.down = true;
            });
            socket.on("left_press", function() {
                players[getIndexFromId(socket.id)].keys.left = true;
            });
            socket.on("right_press", function() {
                players[getIndexFromId(socket.id)].keys.right = true;
            });
            socket.on("up_release", function() {
                players[getIndexFromId(socket.id)].keys.up = false;
            });
            socket.on("down_release", function() {
                players[getIndexFromId(socket.id)].keys.down = false;
            });
            socket.on("left_release", function() {
                players[getIndexFromId(socket.id)].keys.left = false;
            });
            socket.on("right_release", function() {
                players[getIndexFromId(socket.id)].keys.right = false;
            });
            socket.on("creativeModeToggle", function() {

                if (players[getIndexFromId(socket.id)].creativeMode == false) {
                    players[getIndexFromId(socket.id)].creativeMode = true;
                    players[getIndexFromId(socket.id)].hp = 0;
                }
                else {
                    players[getIndexFromId(socket.id)].creativeMode = false;
                }
            });
            socket.on("space_press", function() {
                players[getIndexFromId(socket.id)].keys.space = true;
                for (var cBullet = 0; cBullet < bullets.length; cBullet++) {
                    if (bulletTypes[bullets[cBullet].type].onSpacePress != undefined) {
                        bulletTypes[bullets[cBullet].type].onSpacePress(cBullet, bullets, players, npcs, map, particles, id);
                    }
                }
            });
            socket.on("space_release", function() {
                players[getIndexFromId(socket.id)].keys.space = false;
            });
            socket.on("weaponSelected", function(data) {
                players[getIndexFromId(socket.id)].selectedWeapon = data.weapon;
            });

            socket.on("mouseCoords", function(data) {
                players[getIndexFromId(socket.id)].aimingAt.x = data.mouseX;
                players[getIndexFromId(socket.id)].aimingAt.y = data.mouseY;
            });

            //}keyHandler();

            socket.on("chatMessage", function(data) {
                if (data.message.slice(0, 1) == "!") {
                    if (data.message.slice(1) == "clearparticles") {
                        particles = [];
                    }
                    else if (data.message.slice(1) == "clearnpcs") {
                        npcs = [];
                    }
                    else if (data.message.slice(1, 5) == "kick" && players[getIndexFromId(data.id)].admin == true) {
                        for (var w = 0; w < players.length; w++) {
                            if (data.message.slice(6, data.message.indexOf(" ", 7)).toLowerCase() == players[w].name.toLowerCase()) {
                                players[w].shallBeKicked = true;
                                players[w].kickReason = data.message.slice(data.message.indexOf(" ", 7) + 1);
                            }
                        }
                    }
                    /*else if(data.message.slice(1, 10)=="sethealth"&&users[getIndexFromId(data.id)].admin==true){
                                    for(var w = 0; w < players.length; w++){
                                        if(data.message.slice(11, data.message.indexOf(" ", 12)).toLowerCase()==players[w].name.toLowerCase()){
                                            players[w].hp=parseInt(data.message.slice(data.message.indexOf(" ", data.message.indexOf(" ", 12))));
                                        }
                                    }
                                    
                                }*/
                }
                else {
                    chatMessages.splice(0, 0, players[getIndexFromId(data.id)].name + ": " + data.message);
                    if (chatMessages[maxChatMessages] != undefined) {
                        chatMessages.splice(maxChatMessages, 1);
                    }
                }
                //players[getIndexFromId(socket.id)].messages.splice(0, 0, {message:data.message, expires:data.message.length*4});
                console.log(players[getIndexFromId(data.id)].name + ": " + data.message);
            });

            socket.on("addOrRemoveBlock", function(data) {
                var blockXPos = Math.round(data.x / 20);
                var blockYPos = Math.round(data.y / 20);
                var canPlaceBlock = true;
                for (var i = 0; i < players.length; i++) {
                    if (players[i].x == Math.floor(players[i].x / 20) * 20) {
                        var playerSnappedToGridX = true;
                    }
                    /*if(players[i].y == Math.floor(players[i].y/20)*20){
                        var playerSnappedToGridY=true;
                    }*/
                    if ((blockXPos == Math.floor(players[i].x / 20) && blockYPos == Math.floor(players[i].y / 20)) ||

                        (blockXPos == Math.floor(players[i].x / 20) + 1 &&
                            blockYPos == Math.floor(players[i].y / 20) &&
                            playerSnappedToGridX == false)) {
                        canPlaceBlock = false;
                    }
                }
                if (blockXPos >= 0 && blockXPos < map[0].length && blockYPos >= 0 && blockYPos < map.length && canPlaceBlock == true && players[getIndexFromId(socket.id)].stunned <= 0) {
                    if (map[blockYPos][blockXPos].type == "air") {
                        if (data.selectedBlock == "grass") {
                            var turnIntoEarth = false;
                            //var turnBlockBelowIntoEarth=false;
                            if (map[blockYPos - 1] != null) {
                                if (map[blockYPos - 1][blockXPos].type != "air") {
                                    turnIntoEarth = true;
                                }
                            }
                            if (turnIntoEarth) {
                                map[blockYPos][blockXPos].type = "grass";
                                map[blockYPos][blockXPos].variant = 1;
                            }
                            else {
                                map[blockYPos][blockXPos].type = "grass";
                                map[blockYPos][blockXPos].variant = 0;
                            }

                        }
                        else if (data.selectedBlock == "platform") {
                            map[blockYPos][blockXPos].type = "platform";
                        }
                        else if (data.selectedBlock == "glass") {
                            map[blockYPos][blockXPos].type = "glass";
                        }
                        else if (data.selectedBlock == "reinforcedGlass") {
                            map[blockYPos][blockXPos].type = "reinforcedGlass";
                            map[blockYPos][blockXPos].variant = 0;
                        }
                        else if (data.selectedBlock == "net") {
                            map[blockYPos][blockXPos].type = "net";
                        }
                        else if (data.selectedBlock == "door") {
                            map[blockYPos][blockXPos].type = "door";
                        }
                        else if (data.selectedBlock == "zombie" && npcs.length <= maxNpcs) {
                            npcs.push(new npc("zombie", maxHealth, blockXPos * 20, blockYPos * 20, 5));
                        }
                        if (map[blockYPos + 1] != undefined) {
                            if (map[blockYPos + 1][blockXPos].type == "grass") {
                                map[blockYPos + 1][blockXPos].variant = 1;
                            }
                        }
                    }
                    else {
                        if (map[blockYPos + 1] != undefined) {
                            if (map[blockYPos + 1][blockXPos].type == "grass" && map[blockYPos + 1][blockXPos].variant == 1) {
                                map[blockYPos + 1][blockXPos].variant = 0;
                            }
                        }
                        map[blockYPos][blockXPos].type = "air";

                    }
                }
                io.sockets.emit("map", {
                    map: map
                });
            });
            socket.on("respawn", function() {
                if (players[getIndexFromId(socket.id)].hp <= 0) {
                    var randomX = Math.floor(Math.random() * map[0].length);
                    var randomY = Math.floor(Math.random() * map.length);
                    while (map[randomY][randomX].type != "air") {
                        randomX = Math.floor(Math.random() * map[0].length);
                        randomY = Math.floor(Math.random() * map.length);
                    }
                    players[getIndexFromId(socket.id)].x = randomX * 20;
                    players[getIndexFromId(socket.id)].y = randomY * 20;
                    players[getIndexFromId(socket.id)].hp = maxHealth;
                    players[getIndexFromId(socket.id)].dead = false;
                }
            });
            socket.on("shoot", function(data) {
                var playerIndex = getIndexFromId(socket.id);
                if (players[playerIndex].hp > 0 && players[playerIndex].stunned <= 0 && players[playerIndex].creativeMode == false) {
                    if (data.weapon == 0) {
                        io.sockets.emit("shotFired", {
                            type: "pistol"
                        });
                        bullets.push(new bulletTypes.basicBullet.constructor(15, players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * bulletSpeed,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * bulletSpeed));
                    }
                    else if (data.weapon == 1 && players[getIndexFromId(socket.id)].weapons.shotgun.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "shotgun"
                        });
                        for (var x = 0; x < weapons.shotgun.bullets; x++) {
                            var angle = (Math.random() - 0.5) * weapons.shotgun.spread;
                            var speedModifierX = (Math.random() - 0.5) * weapons.shotgun.bulletSpeedVariation;
                            var speedModifierY = (Math.random() - 0.5) * weapons.shotgun.bulletSpeedVariation;
                            bullets.push(new bulletTypes.basicBullet.constructor(2, players[playerIndex].x + 10 +
                                (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                                players[playerIndex].y + 10 +
                                (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                                Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + angle) * bulletSpeed + speedModifierX,
                                Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + angle) * bulletSpeed + speedModifierY));
                        }

                        players[getIndexFromId(socket.id)].weapons.shotgun.timeSinceFired = weapons.shotgun.fireRate;
                    }
                    else if (data.weapon == 2 && players[getIndexFromId(socket.id)].weapons.rpg.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "RPGShot"
                        });
                        bullets.push(new bulletTypes.rocketGrenade.constructor(players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * weapons.rpg.bulletSpeed,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * weapons.rpg.bulletSpeed));
                        players[getIndexFromId(socket.id)].weapons.rpg.timeSinceFired = weapons.rpg.fireRate;

                    }
                    else if (data.weapon == 3) {
                        addParticle(new particle(players[playerIndex].x + 10,
                            players[playerIndex].y + 10,
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 10,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 10, 1, 500, {
                                r: Math.round(Math.random() * 255),
                                g: Math.round(Math.random() * 255),
                                b: Math.round(Math.random() * 255)
                            }));
                    }
                    else if (data.weapon == 4 && players[getIndexFromId(socket.id)].weapons.smg.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "smg"
                        });
                        var spread = Math.random() * 0.25 - 0.125;
                        bullets.push(new bulletTypes.basicBullet.constructor(10, players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * bulletSpeed,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * bulletSpeed));
                        players[getIndexFromId(socket.id)].weapons.smg.timeSinceFired = weapons.smg.fireRate;
                    }
                    else if (data.weapon == 5 && players[getIndexFromId(socket.id)].weapons.grenade.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "grenade"
                        });
                        var spread = 0;
                        bullets.push(new bulletTypes.grenade.constructor(players[playerIndex].x + 10 + (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 + (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.grenade.throwSthrength,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.grenade.throwSthrength,
                            weapons.grenade.explosionDelay, socket.id));
                        players[getIndexFromId(socket.id)].weapons.grenade.timeSinceFired = weapons.grenade.fireRate;
                    }
                    else if (data.weapon == 6 && players[getIndexFromId(socket.id)].weapons.sniperRifle.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "sniperRifle"
                        });
                        var spread = 0;
                        bullets.push(new bulletTypes.basicBullet.constructor(weapons.sniperRifle.damage, players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.sniperRifle.bulletSpeed,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.sniperRifle.bulletSpeed, 100, socket.id));
                        players[getIndexFromId(socket.id)].weapons.sniperRifle.timeSinceFired = weapons.sniperRifle.fireRate;
                    }
                    else if (data.weapon == 7 && players[getIndexFromId(socket.id)].weapons.taser.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "taser"
                        });
                        var spread = 0;
                        bullets.push(new bulletTypes.taserShot.constructor(players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.taser.bulletSpeed,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.taser.bulletSpeed, 4));
                        players[getIndexFromId(socket.id)].weapons.taser.timeSinceFired = weapons.taser.fireRate;
                    }
                    else if (data.weapon == 8 && players[getIndexFromId(socket.id)].weapons.shockGrenade.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "shockGrenade"
                        });
                        var spread = 0;
                        bullets.push(new bulletTypes.shockGrenade.constructor(players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.shockGrenade.throwSthrength,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.shockGrenade.throwSthrength, weapons.shockGrenade.explosionDelay, socket.id));
                        players[getIndexFromId(socket.id)].weapons.shockGrenade.timeSinceFired = weapons.shockGrenade.fireRate;
                    }
                    else if (data.weapon == 9 && players[getIndexFromId(socket.id)].weapons.c4.timeSinceFired <= 0) {
                        io.sockets.emit("shotFired", {
                            type: "c4"
                        });
                        var spread = 0;
                        bullets.push(new bulletTypes.c4.constructor(players[playerIndex].x + 10 +
                            (Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            players[playerIndex].y + 10 +
                            (Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x)) * 15),
                            Math.cos(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.shockGrenade.throwSthrength,
                            Math.sin(Math.atan2((data.y + players[playerIndex].y) - players[playerIndex].y, (data.x + players[playerIndex].x) - players[playerIndex].x) + spread) * weapons.shockGrenade.throwSthrength, socket.id));
                        players[getIndexFromId(socket.id)].weapons.c4.timeSinceFired = weapons.c4.fireRate;
                    }
                }
            });

            socket.on("disconnect", function() {
                console.log(getDate() + " " + players[getIndexFromId(id)].name + " disconnected");
                if (getIndexFromId(id) != undefined) {
                    players.splice(getIndexFromId(id), 1);
                }

                //clearInterval(interval);z
            });
        }
    });


    function movePlayer() {
        //NPC Code
        var npcsToSplice = [];
        var bulletsToSplice = [];
        var moveZombies = false;
        if (players.length > 0) {
            for (var x = 0; x < players.length; x++) {
                if (players[x].hp > 0 && players[x].creativeMode == false) {
                    moveZombies = true;
                }
            }
        }
        if (moveZombies) {
            for (var x = 0; x < npcs.length; x++) {
                if (npcs[x].stunned > 0) {
                    npcs[x].stunned--;
                }
                var nearestPlayer;
                var playerIndex;
                //npcs[x].x++;
                for (var y = 0; y < players.length; y++) {
                    if (y != 0) {
                        if (calcDistance(npcs[x].x, npcs[x].y, players[y].x, players[y].y) < calcDistance(npcs[x].x, npcs[x].y, nearestPlayer.x, nearestPlayer.y) && players[y].hp > 0 && players[y].creativeMode == false) {
                            nearestPlayer = players[y];
                            playerIndex = y;
                        }
                    }
                    else {
                        nearestPlayer = players[y];
                        playerIndex = y;
                    }
                }

                if (npcs[x].hp <= 0) {
                    npcsToSplice.push(x);
                }
                if (npcs[x].x > nearestPlayer.x - 20 && npcs[x].x < nearestPlayer.x + 20 && npcs[x].y > nearestPlayer.y - 20 && npcs[x].y < nearestPlayer.y + 20 && npcs[x].timeSinceAttack <= 0 && nearestPlayer.hp > 0 && nearestPlayer.creativeMode == false) {
                    npcs[x].timeSinceAttack = 20;
                    players[playerIndex].hp -= weapons.zombie.damage;
                    players[playerIndex].timeUntilHealthRegen = healthRegenTime;
                    var magnitude = 5;
                    var particleNumber = 2;
                    var spread = 1;
                    for (var n = 0; n < particleNumber; n++) {
                        var angle = (Math.PI * 0.5) * Math.random() + (Math.PI * 1.5);
                        addParticle(new particle(players[playerIndex].x + 10, players[playerIndex].y + 10, Math.cos( /*(Math.PI)+*/ angle) * magnitude, Math.sin( /*(Math.PI)+*/ angle) * magnitude, 0, life));
                    }
                }
                if (npcs[x].timeSinceAttack > 0) {
                    npcs[x].timeSinceAttack--;
                }
                if (map[Math.floor(npcs[x].y / 20)] != undefined && map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20)] != undefined) {
                    if ((map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20)].type == "grass" ||
                            map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20)].type == "glass" ||
                            map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20)].type == "reinforcedGlass" ||
                            map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20)].type == "net") /* && npcs[x].y-Math.floor(npcs[x].y)<=15*/ ) {
                        npcs[x].y = Math.floor(npcs[x].y / 20 + 1) * 20;
                        npcs[x].ySpeed = 0;
                        checkLeftRightMovement = false;
                    }
                }
                /*if(map[Math.floor(players[i].y/20)-1][Math.floor(players[i].x/20)+1]==1&&playerSnappedToGridX==false){
                    players[i].y=Math.floor(players[i].y/20)*20;
                    players[i].ySpeed=0;
                    //players[i].hasJumped=false;
                }*/
                if (map[Math.floor(npcs[x].y / 20)] != undefined && map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1] != undefined) {
                    if ((map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "grass" ||
                            map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "glass" ||
                            map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "reinforcedGlass" ||
                            map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "net") && npcs[x].y - Math.floor(npcs[x].y) <= 15 && playerSnappedToGridX == false) {
                        npcs[x].y = Math.floor(npcs[x].y / 20 + 1) * 20;
                        npcs[x].ySpeed = 0;
                        checkLeftRightMovement = false;
                    }
                }
                //}
                npcs[x].ySpeed += gravity;
                npcs[x].y += npcs[x].ySpeed;

                if (npcs[x].x < 0) {
                    npcs[x].x = 0;
                }
                if (npcs[x].y < 0) {
                    npcs[x].y = 0;
                    npcs[x].ySpeed = 0;
                }
                if (npcs[x].x > canvasSizeX - 20) {
                    npcs[x].x = canvasSizeX - 20;
                }
                if (npcs[x].y > canvasSizeY - 20) {
                    npcs[x].y = canvasSizeY - 20;
                    npcs[x].ySpeed = 0;
                    npcs[x].canJump = true;
                }

                var checkBelow = true;
                //Check for collision below
                if (map[Math.floor(npcs[x].y / 20) + 1] != undefined && map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20)] != undefined) {
                    if (map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20)].type == "grass" ||
                        map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20)].type == "platform" ||
                        map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20)].type == "glass" ||
                        map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20)].type == "reinforcedGlass" ||
                        map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20)].type == "net") {
                        npcs[x].y = Math.floor(npcs[x].y / 20) * 20;
                        npcs[x].ySpeed = 0;
                        checkBelow = false;
                        npcs[x].canJump = true;
                    } //Bookmark
                    if (map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1] != undefined) {
                        if ((map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "grass" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "platform" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "glass" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "reinforcedGlass" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "net") && playerSnappedToGridX == false) {
                            npcs[x].y = Math.floor(npcs[x].y / 20) * 20;
                            npcs[x].ySpeed = 0;
                            checkBelow = false;
                        }
                    }
                }

                var canMoveRight = true;
                var canMoveLeft = true;
                for (var z = 0; z < npcs.length; z++) {
                    if (x != z) {
                        if (npcs[x].x > npcs[z].x - 19 && npcs[x].x < npcs[z].x + 19 && npcs[x].y > npcs[z].y - 20 && npcs[x].y < npcs[z].y - 10) {
                            npcs[x].y = npcs[z].y - 20;
                            npcs[x].ySpeed = 0;
                            if (npcs[x].x != nearestPlayer.x) {
                                npcs[x].ySpeed = zombieJumpHeight;
                            }
                        }
                        else
                        if (npcs[x].x > npcs[z].x - 20 &&
                            npcs[x].x < npcs[z].x &&
                            npcs[x].y >= npcs[z].y - 20 &&
                            npcs[x].y < npcs[z].y) {
                            if (npcs[x].canJump == true) {
                                npcs[x].ySpeed = zombieJumpHeight;
                                npcs[x].canJump = false;
                            }
                            npcs[x].x = npcs[z].x - 21;
                        }
                        else
                        if (npcs[x].x > npcs[z].x && npcs[x].x < npcs[z].x + 20 && npcs[x].y > npcs[z].y - 19 && npcs[x].y <= npcs[z].y) {
                            if (npcs[x].canJump == true) {
                                npcs[x].ySpeed = zombieJumpHeight;
                                npcs[x].canJump = false;
                            }
                            npcs[x].x = npcs[z].x + 21;
                        }


                    }
                }
                //Collisions left
                if (npcs[x].stunned <= 0) {
                    if (npcs[x].x > nearestPlayer.x) {

                        if ( /*playerSnappedToGridX*/ true) {
                            if (map[Math.floor(npcs[x].y / 20)] != undefined && map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) - 1] != undefined) {
                                if (map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) - 1].type == "grass" ||
                                    map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) - 1].type == "glass" ||
                                    map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) - 1].type == "reinforcedGlass" ||
                                    map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) - 1].type == "net") {
                                    canMoveLeft = false;
                                }
                            }
                            if (map[Math.floor(npcs[x].y / 20) + 1] != undefined && map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) - 1] != undefined && checkBelow) {
                                if (map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) - 1].type == "grass" ||
                                    map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) - 1].type == "glass" ||
                                    map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) - 1].type == "reinforcedGlass" ||
                                    map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) - 1].type == "net") {
                                    canMoveLeft = false;
                                }
                            }
                        }

                        if (canMoveLeft) {
                            npcs[x].x -= npcs[x].speed;
                        }
                        else {
                            npcs[x].x = Math.floor(npcs[x].x / 20) * 20;
                            if (npcs[x].canJump == true) {
                                npcs[x].ySpeed = zombieJumpHeight;
                                npcs[x].canJump = false;
                            }
                        }
                    }
                    if (npcs[x].x < nearestPlayer.x) {
                        if (map[Math.floor(npcs[x].y / 20)] != undefined && map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1] != undefined) {
                            if (map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "grass" ||
                                map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "glass" ||
                                map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "reinforcedGlass" ||
                                map[Math.floor(npcs[x].y / 20)][Math.floor(npcs[x].x / 20) + 1].type == "net") {
                                canMoveRight = false;
                            }
                        }
                        if (map[Math.floor(npcs[x].y / 20) + 1] != undefined && map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1] != undefined && checkBelow) {
                            if (map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "grass" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "glass" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "reinforcedGlass" ||
                                map[Math.floor(npcs[x].y / 20) + 1][Math.floor(npcs[x].x / 20) + 1].type == "net") {
                                canMoveRight = false;
                            }
                        }
                        if (canMoveRight) {
                            npcs[x].x += npcs[x].speed;
                        }
                        else {
                            npcs[x].x = Math.floor(npcs[x].x / 20) * 20;
                            if (npcs[x].canJump == true) {
                                npcs[x].ySpeed = zombieJumpHeight;
                                npcs[x].canJump = false;
                            }
                        }
                    }

                }
            }
        }
        for (var n = 0; n < npcsToSplice.length; n++) {
            var magnitude = 20;
            var particleNumber = 10;
            var spread = 1;
            for (var y = 0; y < particleNumber; y++) {
                var angle = (Math.PI * 2) * Math.random();
                addParticle(new particle(npcs[npcsToSplice[n] - n].x + 10, npcs[npcsToSplice[n] - n].y + 10, Math.cos( /*(Math.PI)+*/ angle) * magnitude + Math.random(), Math.sin( /*(Math.PI)+*/ angle) * magnitude + Math.random(), 2, life));
            }
            npcs.splice(npcsToSplice[n] - n, 1);
            if (Math.random() > 0.75) {
                io.sockets.emit("zombieDeath");
            }
        }
        //Update Bullets
        var particlesToSplice = [];
        for (var i = 0; i < particles.length; i++) {
            if (particles[i].type != 3 && particles[i].type != 4 && particles[i].type != 5) {
                particles[i].ys += gravity;
                if (particles[i].x <= 0 || particles[i].x >= map[0].length * 20 || particles[i].y <= 0 || particles[i].y >= map.length * 20 || map[Math.floor(particles[i].y / 20)][Math.floor(particles[i].x / 20)].type == "grass" || map[Math.floor(particles[i].y / 20)][Math.floor(particles[i].x / 20)].type == "glass") {
                    particles[i].xs = 0;
                    particles[i].ys = 0;
                    //spliceAt=i;
                }
            }
            particles[i].life--;
            if (particles[i].type != 3 && particles[i].type != 4 && particles[i].type != 5) {
                particles[i].x += particles[i].xs;
                particles[i].y += particles[i].ys;
            }
            if (particles[i].life <= 0) {
                particlesToSplice.push(i);
            }

        }
        for (var n = 0; n < particlesToSplice.length; n++) {
            particles.splice(particlesToSplice[n] - n, 1);
        }
        //var spliceAt = null;
        updateBullets(bullets, players, npcs, particles);
        for (var cBullet = 0; cBullet < bullets.length; cBullet++) {
            if (bullets[cBullet].shallSplice) {
                bullets.splice(cBullet, 1);
                cBullet--;
            }
            else {

            }
        }
        /*if(spliceAt!=null){
        	bullets.splice(spliceAt, 1); 
        }*/

        //Player stuff
        var playersToDisconnect = [];
        for (var i = 0; i < players.length; i++) {
            if (players[i].shallBeKicked == true) {
                playersToDisconnect.push(i);
            }
            if (players[i].stunned > weapons.taser.taseDelay) {
                players[i].stunned--;
            }
            if (players[i].dead == false && players[i].hp <= 0) {
                players[i].dead = true;
                io.sockets.emit("death", {
                    id: players[i].id
                });
                var magnitude = 30;
                var particleNumber = 150;
                var spread = 1;
                for (var y = 0; y < particleNumber; y++) {
                    var angle = (Math.PI * 2) * Math.random();
                    addParticle(new particle(players[i].x + 10, players[i].y + 10, Math.cos( /*(Math.PI)+*/ angle) * magnitude + Math.random(), Math.sin( /*(Math.PI)+*/ angle) * magnitude + Math.random(), 0, life));
                }
                for (var y = 0; y < 1; y++) {
                    var angle = (Math.PI * 2) * Math.random();
                    addParticle(new particle(players[i].x + 10, players[i].y + 10, Math.cos(angle) + Math.random(), Math.sin(angle) + Math.random(), 0, life));
                }
            }
            if (players[i].hp > 0) {
                if (players[i].timeUntilHealthRegen <= 0) {
                    if (players[i].hp < 100) {
                        players[i].hp += healthRegenRate;
                    }
                }
                else {
                    players[i].timeUntilHealthRegen--;
                }
                var currentPlayer = players[i];
                var playerSnappedToGridX = false;
                var checkLeftRightMovement = true;
                if (players[i].x == Math.floor(players[i].x / 20) * 20) {
                    playerSnappedToGridX = true;
                }
                /*n = 0;
                while(bulletsToSplice.length>0){
                	bullets.splice(bulletsToSplice[0]-n, 1);
                	n++;
                }*/



                //if(map[Math.floor(players[i].y/20)-1]!=undefined&&){
                /*if(map[Math.floor(players[i].y/20)-1][Math.floor(players[i].x/20)]==1&&Math.floor(players[i].y)==players[i].y){
                    players[i].y=Math.floor(players[i].y/20)*20;
                    players[i].ySpeed=0;
                }*/
                if (map[Math.floor(players[i].y / 20)] != undefined && map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20)] != undefined) {
                    if ((map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20)].type == "grass" ||
                            map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20)].type == "glass" ||
                            map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20)].type == "reinforcedGlass" ||
                            map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20)].type == "net") && players[i].y - Math.floor(players[i].y) <= 15) {
                        players[i].y = Math.floor(players[i].y / 20 + 1) * 20;
                        players[i].ySpeed = 0;
                        checkLeftRightMovement = false;
                    }
                }
                /*if(map[Math.floor(players[i].y/20)-1][Math.floor(players[i].x/20)+1]==1&&playerSnappedToGridX==false){
                    players[i].y=Math.floor(players[i].y/20)*20;
                    players[i].ySpeed=0;
                    //players[i].hasJumped=false;
                }*/
                if (map[Math.floor(players[i].y / 20)] != undefined && map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1] != undefined) {
                    if ((map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "grass" ||
                            map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "glass" ||
                            map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "reinforcedGlass" ||
                            map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "net") && players[i].y - Math.floor(players[i].y) <= 15 && playerSnappedToGridX == false) {
                        players[i].y = Math.floor(players[i].y / 20 + 1) * 20;
                        players[i].ySpeed = 0;
                        checkLeftRightMovement = false;
                    }
                }
                //}
                players[i].ySpeed += gravity;
                players[i].y += players[i].ySpeed;

                if (currentPlayer.keys.down) {
                    //currentPlayer.y+=5;
                }
                var checkBelow = true;
                //Check for collision below
                if (map[Math.floor(players[i].y / 20) + 1] != undefined && map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20)] != undefined) {
                    if (map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20)].type == "grass" ||
                        map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20)].type == "platform" ||
                        map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20)].type == "glass" ||
                        map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20)].type == "reinforcedGlass" ||
                        map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20)].type == "net") {
                        players[i].y = Math.floor(players[i].y / 20) * 20;
                        players[i].ySpeed = 0;
                        players[i].hasJumped = false;
                        checkBelow = false;
                    } //Bookmark
                    if (map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1] != undefined) {
                        if ((map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "grass" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "platform" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "glass" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "reinforcedGlass" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "net") && playerSnappedToGridX == false) {
                            players[i].y = Math.floor(players[i].y / 20) * 20;
                            players[i].ySpeed = 0;
                            players[i].hasJumped = false;
                            checkBelow = false;
                        }
                    }
                }

                //Collisions left
                if (checkLeftRightMovement) {
                    if (currentPlayer.keys.left && currentPlayer.stunned <= 0) {
                        var canMoveLeft = true;
                        if (playerSnappedToGridX) {
                            if (map[Math.floor(players[i].y / 20)] != undefined && map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) - 1] != undefined) {
                                if (map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) - 1].type == "grass" ||
                                    map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) - 1].type == "glass" ||
                                    map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) - 1].type == "reinforcedGlass" ||
                                    map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) - 1].type == "net") {
                                    canMoveLeft = false;
                                }
                            }
                            if (map[Math.floor(players[i].y / 20) + 1] != undefined && map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) - 1] != undefined && checkBelow) {
                                if (map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) - 1].type == "grass" ||
                                    map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) - 1].type == "glass" ||
                                    map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) - 1].type == "reinforcedGlass" ||
                                    map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) - 1].type == "net") {
                                    canMoveLeft = false;
                                }
                            }
                        }

                        if (canMoveLeft) {
                            currentPlayer.x -= leftRightMovementSpeed;
                        }
                        else {
                            players[i].x = Math.floor(players[i].x / 20) * 20;
                        }
                    }
                    if (currentPlayer.keys.right && currentPlayer.stunned <= 0) {
                        var canMoveRight = true;
                        if (map[Math.floor(players[i].y / 20)] != undefined && map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1] != undefined) {
                            if (map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "grass" ||
                                map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "glass" ||
                                map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "reinforcedGlass" ||
                                map[Math.floor(players[i].y / 20)][Math.floor(players[i].x / 20) + 1].type == "net") {
                                canMoveRight = false;
                            }
                        }
                        if (map[Math.floor(players[i].y / 20) + 1] != undefined && map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1] != undefined && checkBelow) {
                            if (map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "grass" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "glass" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "reinforcedGlass" ||
                                map[Math.floor(players[i].y / 20) + 1][Math.floor(players[i].x / 20) + 1].type == "net") {
                                canMoveRight = false;
                            }
                        }
                        if (canMoveRight) {
                            currentPlayer.x += leftRightMovementSpeed;
                        }
                        else {
                            players[i].x = Math.floor(players[i].x / 20) * 20;
                        }
                    }
                }




                if (currentPlayer.x < 0) {
                    players[i].x = 0;
                }
                if (currentPlayer.y < 0) {
                    players[i].y = 0;
                    players[i].ySpeed = 0;
                }
                if (currentPlayer.x > canvasSizeX - 20) {
                    players[i].x = canvasSizeX - 20;
                }
                if (currentPlayer.y > canvasSizeY - 20) {
                    players[i].y = canvasSizeY - 20;
                    players[i].ySpeed = 0;
                    players[i].hasJumped = false;
                }
                //Crash detection left
                //Crash detection right
                if (currentPlayer.keys.up && players[i].hasJumped == false && currentPlayer.stunned <= 0) {
                    players[i].ySpeed = -jumpStrength;
                    players[i].hasJumped = true;
                    io.sockets.emit("jump");
                }

                var spliceAt = null;
                /*for(var z = 0; z < players[i].messages.length; z++){
                    players[i].messages[z].expires--;
                    if(players[i].messages[z].expires<=0){
                        spliceAt=z;
                    }
                }*/
                if (spliceAt != null) {
                    players[i].messages.splice(spliceAt, 1);
                }
                if (players[i].selectedWeapon == 7) {
                    var lx = players[i].x + 10;
                    var ly = players[i].y + 10;
                    var lxs = Math.cos(Math.atan2(players[i].aimingAt.y - (players[i].y + 10), (players[i].aimingAt.x - (players[i].x + 10))));
                    var lys = Math.sin(Math.atan2(players[i].aimingAt.y - (players[i].y + 10), (players[i].aimingAt.x - (players[i].x + 10))));
                    var iterate = true;
                    while (iterate) {
                        lx += lxs;
                        ly += lys;
                        if (map[Math.round((ly - 10) / 20)] != undefined &&
                            map[Math.round((ly - 10) / 20)][Math.round((lx - 10) / 20)] != undefined) {
                            if (map[Math.round((ly - 10) / 20)][Math.round((lx - 10) / 20)].type == "grass" || map[Math.round((ly - 10) / 20)][Math.round((lx - 10) / 20)].type == "door") {
                                iterate = false;
                            }
                        }
                        else {
                            iterate = false;
                        }
                    }
                    addParticle(new particle(players[i].x + 10, players[i].y + 10, lx, ly, 3, 1));
                }
                if (players[i].weapons.shotgun.timeSinceFired > 0) {
                    players[i].weapons.shotgun.timeSinceFired--;
                }
                if (players[i].weapons.smg.timeSinceFired > 0) {
                    players[i].weapons.smg.timeSinceFired--;
                }
                if (players[i].weapons.rpg.timeSinceFired > 0) {
                    players[i].weapons.rpg.timeSinceFired--;
                }
                if (players[i].weapons.grenade.timeSinceFired > 0) {
                    players[i].weapons.grenade.timeSinceFired--;
                }
                if (players[i].weapons.sniperRifle.timeSinceFired > 0) {
                    players[i].weapons.sniperRifle.timeSinceFired--;
                }
                if (players[i].weapons.taser.timeSinceFired > 0) {
                    players[i].weapons.taser.timeSinceFired--;
                }
                if (players[i].weapons.shockGrenade.timeSinceFired > 0) {
                    players[i].weapons.shockGrenade.timeSinceFired--;
                }
                if (players[i].weapons.c4.timeSinceFired > 0) {
                    players[i].weapons.c4.timeSinceFired--;
                }
            }
        }

        var minimizedPlayers = [];
        for (var m = 0; m < players.length; m++) {
            var facing = "forward";
            if (players[m].keys.left) {
                facing = "left";
            }
            else if (players[m].keys.right) {
                facing = "right";
            }
            minimizedPlayers.push({
                x: players[m].x,
                y: players[m].y,
                hp: players[m].hp,
                name: players[m].name,
                id: players[m].id,
                messages: players[m].messages,
                facing: facing,
                stunned: players[m].stunned,
                creativeMode: players[m].creativeMode
            });
        }
        io.sockets.emit("playerArray", {
            players: minimizedPlayers,
            bullets: bullets,
            npcs: npcs,
            messages: chatMessages
        });
        for (var c = 0; c < playersToDisconnect.length; c++) {
            //players.splice(playersToDisconnect[c]-c, 1);
            io.sockets.connected[players[playersToDisconnect - c].id].emit("kicked", {
                reason: players[playersToDisconnect].kickReason
            });
            io.sockets.connected[players[playersToDisconnect - c].id].disconnect();
        }
    }
    setInterval(movePlayer, 50);

    function saveMap() {
        mapFile.map = map;
        fs.writeFile("../" + mapName, JSON.stringify(mapFile));
    }
    setInterval(saveMap, 5000);

    /*function reloadUsers(){
        fs.readFile("users.json", function(err, data) {
            if(err){
                return console.error(err);
            }
            users = JSON.parse(data).users;
            //console.log(getDate() + " " + "users.json reloaded");
        });
    }*/

    //setInterval(reloadUsers, 60000);

}
