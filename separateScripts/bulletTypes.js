var calcStraightLine = require("./calculateStraightLine.js");
var calcDistance = require("./calculateDistance");
var blocks = require("./blocks.js");
var Coordinate = require("./coordinate.js");
var server = require("../server.js");
var particle = require("./particle.js");

module.exports = {
    basicBullet: {
        constructor: function(dmg, x, y, xs, ys) {
            this.dmg = dmg;
            this.x = x;
            this.y = y;
            this.xs = xs;
            this.ys = ys;
            this.shallSplice = false;
            this.type = "basicBullet";
        },
        onTick: function(bulletIndex, bullets, players, npcs, map, particles) {
            var hasHit = false;
            var positions = calcStraightLine(Math.round(bullets[bulletIndex].x), Math.round(bullets[bulletIndex].y), Math.round(bullets[bulletIndex].x + bullets[bulletIndex].xs), Math.round(bullets[bulletIndex].y + bullets[bulletIndex].ys));
            for (var n = 0; n < positions.length; n++) {
                if (positions[n].x < 0 || positions[n].x >= map[0].length * 20 || positions[n].y < 0 || positions[n].y >= map.length * 20) {
                    bullets[bulletIndex].shallSplice = true;
                }
                else if (map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type != "air" && hasHit == false) {
                    if (blocks[map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type].blocksBullets) {
                        bullets[bulletIndex].shallSplice = true;
                    }
                    if (blocks[map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type].onBulletHit != undefined) {
                        blocks[map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type].onBulletHit(new Coordinate(Math.floor(positions[n].y / 20), Math.floor(positions[n].x / 20)));
                    }
                    hasHit = true;
                }
                for (var cNpc = 0; cNpc < npcs.length; cNpc++) {
                    if (positions[n].x > npcs[cNpc].x && positions[n].x < npcs[cNpc].x + 20 && positions[n].y > npcs[cNpc].y && positions[n].y < npcs[cNpc].y + 20 && hasHit == false && bullets[bulletIndex].shallSplice == false) {
                        hasHit = true;
                        npcs[cNpc].hp -= bullets[bulletIndex].dmg;
                        bullets[bulletIndex].shallSplice = true;
                    }
                }
                for (var cPlayer = 0; cPlayer < players.length; cPlayer++) {
                    if (positions[n].x > players[cPlayer].x && positions[n].x < players[cPlayer].x + 20 && positions[n].y > players[cPlayer].y && positions[n].y < players[cPlayer].y + 20 && hasHit == false) {
                        players[cPlayer].hp -= bullets[bulletIndex].dmg;
                        hasHit = true;
                        players[cPlayer].timeUntilHealthRegen = 200;
                        bullets[bulletIndex].shallSplice = true;
                    }
                }
            }
            bullets[bulletIndex].x += bullets[bulletIndex].xs;
            bullets[bulletIndex].y += bullets[bulletIndex].ys;
            if (hasHit) {
                server.writeBullets(bullets);
            }

        },
        type: "basicBullet"
    },
    rocketGrenade: {
        constructor: function(x, y, xs, ys) {
            this.x = x;
            this.y = y;
            this.xs = xs;
            this.ys = ys;
            this.shallSplice = false;
            this.type = "rocketGrenade";
        },
        onTick: function(bulletIndex, bullets, players, npcs, map, particles) {
            var hasHit = false;
            var positions = calcStraightLine(Math.round(bullets[bulletIndex].x), Math.round(bullets[bulletIndex].y), Math.round(bullets[bulletIndex].x + bullets[bulletIndex].xs), Math.round(bullets[bulletIndex].y + bullets[bulletIndex].ys));
            for (var n = 0; n < positions.length; n++) {
                if (positions[n].x < 0 || positions[n].x >= map[0].length * 20 || positions[n].y < 0 || positions[n].y >= map.length * 20) {
                    bullets[bulletIndex].shallSplice = true;
                    server.createExplosion(positions[n].x, positions[n].y, 100, 100);
                }
                else if (map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type != "air" && hasHit == false) {
                    if (blocks[map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type].blocksBullets) {
                        bullets[bulletIndex].shallSplice = true;
                        server.createExplosion(positions[n].x, positions[n].y, 100, 100);
                    }
                    hasHit = true;
                }
                for (var cNpc = 0; cNpc < npcs.length; cNpc++) {
                    if (positions[n].x > npcs[cNpc].x && positions[n].x < npcs[cNpc].x + 20 && positions[n].y > npcs[cNpc].y && positions[n].y < npcs[cNpc].y + 20 && hasHit == false && bullets[bulletIndex].shallSplice == false) {
                        hasHit = true;
                        server.createExplosion(positions[n].x, positions[n].y, 100, 100);
                        bullets[bulletIndex].shallSplice = true;
                    }
                }
                for (var cPlayer = 0; cPlayer < players.length; cPlayer++) {
                    if (positions[n].x > players[cPlayer].x && positions[n].x < players[cPlayer].x + 20 && positions[n].y > players[cPlayer].y && positions[n].y < players[cPlayer].y + 20 && hasHit == false && bullets[bulletIndex].shallSplice == false) {
                        server.createExplosion(positions[n].x, positions[n].y, 100, 100);
                        hasHit = true;
                        bullets[bulletIndex].shallSplice = true;
                    }
                }
            }
            bullets[bulletIndex].x += bullets[bulletIndex].xs;
            bullets[bulletIndex].y += bullets[bulletIndex].ys;
            if (hasHit) {
                server.writeBullets(bullets);
            }
        }
    },
    grenade: {
        constructor: function(x, y, xs, ys, life, thrower) {
            this.x = x;
            this.y = y;
            this.xs = xs;
            this.ys = ys;
            this.life = 100;
            this.thrower = thrower;
            this.shallSplice = false;
            this.type = "grenade";
        },
        onTick: function(bulletIndex, bullets, players, npcs, map, particles) {
            var moveGrenade = true;
            var positions = calcStraightLine(Math.floor(bullets[bulletIndex].x), Math.floor(bullets[bulletIndex].y), Math.floor(bullets[bulletIndex].x + bullets[bulletIndex].xs), Math.floor(bullets[bulletIndex].y + bullets[bulletIndex].ys));
            for (var cPos = 0; cPos < positions.length; cPos++) {
                if (positions[cPos].x < 0 || positions[cPos].x > map[0].length * 20) {
                    bullets[bulletIndex].xs *= -1;
                    break;
                }
                if (positions[cPos].y < 0 || positions[cPos].y > map.length * 20) {
                    bullets[bulletIndex].ys *= -1;
                    break;
                }
                if (map[Math.floor(positions[cPos].y / 20)] != undefined &&
                    map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)] != undefined &&
                    map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)].type != "air" && blocks[map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)].type].blocksBullets) {
                    if (cPos == 0) {
                        bullets[bulletIndex].xs *= -1;
                        bullets[bulletIndex].ys *= -1;
                    }
                    else if (Math.floor(positions[cPos - 1].x / 20) == Math.floor(positions[cPos].x / 20)) {
                        bullets[bulletIndex].ys *= -1;
                        bullets[bulletIndex].x = positions[cPos - 1].x;
                        bullets[bulletIndex].y = positions[cPos - 1].y;
                        moveGrenade = false;
                    }
                    else if (Math.floor(positions[cPos - 1].y / 20) == Math.floor(positions[cPos].y / 20)) {
                        bullets[bulletIndex].xs *= -1;
                        bullets[bulletIndex].x = positions[cPos - 1].x;
                        bullets[bulletIndex].y = positions[cPos - 1].y;
                        moveGrenade = false;
                    }
                    else {
                        bullets[bulletIndex].ys *= -1;
                        bullets[bulletIndex].xs *= -1;
                        bullets[bulletIndex].x = positions[cPos - 1].x;
                        bullets[bulletIndex].y = positions[cPos - 1].y;
                        moveGrenade = false;
                    }

                    break;
                }
            }
            bullets[bulletIndex].ys += 1;
            //if(bullets[bulletIndex].life<=0||players[]){
            if (moveGrenade) {
                bullets[bulletIndex].x += bullets[bulletIndex].xs;
                bullets[bulletIndex].y += bullets[bulletIndex].ys;
            }
        },
        onSpacePress: function(bulletIndex, bullets, players, npcs, map, particles, id) {
            if (bullets[bulletIndex].thrower == id) {
                server.createExplosion(bullets[bulletIndex].x, bullets[bulletIndex].y, 200, 100);
                bullets[bulletIndex].shallSplice = true;
            }
        }
    },
    taserShot: {
        constructor: function(x, y, xs, ys) {
            this.x = x;
            this.y = y;
            this.xs = xs;
            this.ys = ys;
            this.shallSplice = false;
            this.type = "taserShot";
        },
        onTick: function(bulletIndex, bullets, players, npcs, map, particles) {
            var hasHit = false;
            var positions = calcStraightLine(Math.round(bullets[bulletIndex].x), Math.round(bullets[bulletIndex].y), Math.round(bullets[bulletIndex].x + bullets[bulletIndex].xs), Math.round(bullets[bulletIndex].y + bullets[bulletIndex].ys));
            for (var n = 0; n < positions.length; n++) {
                if (positions[n].x < 0 || positions[n].x >= map[0].length * 20 || positions[n].y < 0 || positions[n].y >= map.length * 20) {
                    bullets[bulletIndex].shallSplice = true;
                }
                else if (map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type != "air" && hasHit == false) {
                    if (blocks[map[Math.floor(positions[n].y / 20)][Math.floor(positions[n].x / 20)].type].blocksBullets) {
                        bullets[bulletIndex].shallSplice = true;
                    }
                    hasHit = true;
                }
                for (var cNpc = 0; cNpc < npcs.length; cNpc++) {
                    if (positions[n].x > npcs[cNpc].x && positions[n].x < npcs[cNpc].x + 20 && positions[n].y > npcs[cNpc].y && positions[n].y < npcs[cNpc].y + 20 && hasHit == false && bullets[bulletIndex].shallSplice == false) {
                        hasHit = true;
                        npcs[cNpc].stunned = 200;
                        bullets[bulletIndex].shallSplice = true;
                    }
                }
                for (var cPlayer = 0; cPlayer < players.length; cPlayer++) {
                    if (positions[n].x > players[cPlayer].x && positions[n].x < players[cPlayer].x + 20 && positions[n].y > players[cPlayer].y && positions[n].y < players[cPlayer].y + 20 && hasHit == false && bullets[bulletIndex].shallSplice == false && players[cPlayer].stunned <= -40) {
                        players[cPlayer].stunned = 50;
                        hasHit = true;
                        bullets[bulletIndex].shallSplice = true;
                    }
                }
            }
            bullets[bulletIndex].x += bullets[bulletIndex].xs;
            bullets[bulletIndex].y += bullets[bulletIndex].ys;
            if (hasHit) {
                server.writeBullets(bullets);
            }

        },
        type: "basicBullet"
    },
    shockGrenade: {
        constructor: function(x, y, xs, ys, life, thrower) {
            this.x = x;
            this.y = y;
            this.xs = xs;
            this.ys = ys;
            this.life = 100;
            this.thrower = thrower;
            this.shallSplice = false;
            this.type = "shockGrenade";
        },
        onTick: function(bulletIndex, bullets, players, npcs, map, particles) {
            var moveShockGrenade = true;
            var positions = calcStraightLine(Math.floor(bullets[bulletIndex].x), Math.floor(bullets[bulletIndex].y), Math.floor(bullets[bulletIndex].x + bullets[bulletIndex].xs), Math.floor(bullets[bulletIndex].y + bullets[bulletIndex].ys));
            for (var cPos = 0; cPos < positions.length; cPos++) {
                if (positions[cPos].x < 0 || positions[cPos].x > map[0].length * 20) {
                    bullets[bulletIndex].xs *= -1;
                    break;
                }
                if (positions[cPos].y < 0 || positions[cPos].y > map.length * 20) {
                    bullets[bulletIndex].ys *= -1;
                    break;
                }
                if (map[Math.floor(positions[cPos].y / 20)] != undefined &&
                    map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)] != undefined &&
                    map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)].type != "air" && blocks[map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)].type].blocksBullets) {
                    if (cPos == 0) {
                        bullets[bulletIndex].xs *= -1;
                        bullets[bulletIndex].ys *= -1;
                    }
                    else if (Math.floor(positions[cPos - 1].x / 20) == Math.floor(positions[cPos].x / 20)) {
                        bullets[bulletIndex].ys *= -1;
                        bullets[bulletIndex].x = positions[cPos - 1].x;
                        bullets[bulletIndex].y = positions[cPos - 1].y;
                        moveShockGrenade = false;
                    }
                    else if (Math.floor(positions[cPos - 1].y / 20) == Math.floor(positions[cPos].y / 20)) {
                        bullets[bulletIndex].xs *= -1;
                        bullets[bulletIndex].x = positions[cPos - 1].x;
                        bullets[bulletIndex].y = positions[cPos - 1].y;
                        moveShockGrenade = false;
                    }
                    else {
                        bullets[bulletIndex].ys *= -1;
                        bullets[bulletIndex].xs *= -1;
                        bullets[bulletIndex].x = positions[cPos - 1].x;
                        bullets[bulletIndex].y = positions[cPos - 1].y;
                        moveShockGrenade = false;
                    }
                    break;
                }
            }
            bullets[bulletIndex].ys += 1;
            //if(bullets[bulletIndex].life<=0||players[]){
            if (moveShockGrenade) {
                bullets[bulletIndex].x += bullets[bulletIndex].xs;
                bullets[bulletIndex].y += bullets[bulletIndex].ys;
            }
        },
        onSpacePress: function(bulletIndex, bullets, players, npcs, map, particles, id) {
            if (bullets[bulletIndex].thrower == id) {
                for (var cPlayer = 0; cPlayer < players.length; cPlayer++) {
                    if (calcDistance(bullets[bulletIndex].x + 10, bullets[bulletIndex].y + 10, players[cPlayer].x, players[cPlayer].y) <= 150 && players[cPlayer].stunned <= 40) {
                        players[cPlayer].stunned = 50;
                    }
                }
                for (var cNpc = 0; cNpc < npcs.length; cNpc++) {
                    if (calcDistance(bullets[bulletIndex].x + 10, bullets[bulletIndex].y + 10, npcs[cNpc].x, npcs[cNpc].y) <= 150) {
                        npcs[cNpc].stunned = 100;
                    }
                }
                server.addParticle(new particle(bullets[bulletIndex].x, bullets[bulletIndex].y, 150, 20, 4, 20));
                bullets[bulletIndex].shallSplice = true;
            }
        }
    },
    c4: {
        constructor: function(x, y, xs, ys, thrower) {
            this.x = x;
            this.y = y;
            this.xs = xs;
            this.ys = ys;
            this.thrower = thrower;
            this.shallSplice = false;
            this.stuck = false;
            this.type = "c4";
        },
        onTick: function(bulletIndex, bullets, players, npcs, map, particles) {
            var hasHit = false;
            var positions = calcStraightLine(Math.floor(bullets[bulletIndex].x), Math.floor(bullets[bulletIndex].y), Math.floor(bullets[bulletIndex].x + bullets[bulletIndex].xs), Math.floor(bullets[bulletIndex].y + bullets[bulletIndex].ys));
            for (var cPos = 0; cPos < positions.length; cPos++) {
                if (positions[cPos].x < 0 || positions[cPos].x > map[0].length * 20 || positions[cPos].y < 0 || positions[cPos].y > map.length * 20) {
                    bullets[bulletIndex].stuck = true;
                    break;
                }
                if (map[Math.floor(positions[cPos].y / 20)] != undefined &&
                    map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)] != undefined &&
                    map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)].type != "air" && blocks[map[Math.floor(positions[cPos].y / 20)][Math.floor(positions[cPos].x / 20)].type].blocksBullets) {
                    bullets[bulletIndex].stuck = true;
                    bullets[bulletIndex].x = positions[cPos].x;
                    bullets[bulletIndex].y = positions[cPos].y;
                    break;
                }
            }
            bullets[bulletIndex].ys += 1;
            //if(bullets[bulletIndex].life<=0||players[]){
            if (!bullets[bulletIndex].stuck) {
                bullets[bulletIndex].x += bullets[bulletIndex].xs;
                bullets[bulletIndex].y += bullets[bulletIndex].ys;
            }
        },
        onSpacePress: function(bulletIndex, bullets, players, npcs, map, particles, id) {
            if (bullets[bulletIndex].thrower == id && bullets[bulletIndex].stuck) {
                server.createExplosion(bullets[bulletIndex].x, bullets[bulletIndex].y, 200, 100);
                bullets[bulletIndex].shallSplice = true;
            }
        }
    }
};
