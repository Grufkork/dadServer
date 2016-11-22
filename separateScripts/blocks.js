var server = require("../server.js");

module.exports={
    grass:{
        blocksBullets:true
    },
    platform:{
        blocksBullets:false
    },
    glass:{
        blocksBullets:true,
        onBulletHit:function(position){
            var map = server.getMap();
            map[position.y][position.x].type="air";
            server.writeMap(map);
        }
    },
    reinforcedGlass:{
        blocksBullets:true,
        onBulletHit:function(position){
            var map = server.getMap();
            if(map[position.y][position.x].variant==0){
                map[position.y][position.x].variant=1;
            }else if(map[position.y][position.x].variant==1){
                map[position.y][position.x].variant=2;
            }else if(map[position.y][position.x].variant==2){
                map[position.y][position.x].type="air";
            }
            server.writeMap(map);
        }
    },
    net:{
        blocksBullets:false
    },
    door:{
        blocksBullets:true
    }
};