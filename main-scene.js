// billiards constants
const BALL_RAD = 3;
const TABLE_WIDTH = BALL_RAD * 6 * 8;
const TABLE_HEIGHT = BALL_RAD * 6 * 14.5;

// pocket constants
const POCKET_POSITIONS = [
    Vec.of(0.955 * TABLE_WIDTH / 2, 0.98 * TABLE_HEIGHT / 2, 0),
    Vec.of(-0.955 * TABLE_WIDTH / 2, 0.98 * TABLE_HEIGHT / 2, 0),
    Vec.of(0.955 * TABLE_WIDTH / 2, -0.98 * TABLE_HEIGHT / 2, 0),
    Vec.of(-0.955 * TABLE_WIDTH / 2, -0.98 * TABLE_HEIGHT / 2, 0),
    Vec.of(TABLE_WIDTH / 2, 0, 0),
    Vec.of(-TABLE_WIDTH / 2, 0, 0)
];
const POCKET_RAD = 1.85 * BALL_RAD; // balls count as sunk if they get within this distance of a pocket position

// const FRICTION_ACC = 0.01; // units per tick^2 - looks unnatural
const FRICTION_SPEED_FRACTION = 0.99; // each tick, the speed of each ball is multiplied by this coefficient
const FRICTION_MIN_SPEED = 0.01; // at this speed, friction will immediately stop the ball

const COLLISION_FRACTION = 0.99; // the amount of relative velocity components that colliding balls exchange
// lowering this beyond its maximum of 1 has the effect of lowering average kinetic energy while still conserving momentum of a collision
// seems to make collisions look a little more realistic - might simulate effects of rolling balls

const REWIND_MARGIN = -1e-6 // allows previous collision times to be detected and time rewound up to this amount
// due to floating point error for collisions that happen almost simultaneously

const MAX_HITTING_SPEED = 10; // max speed achievable when hitting the cue ball

const MAX_GRAV_ACC = 0.1; // acceleration (units/s^2) of balls downwards when they are fully in a pocket circle

shadowmat = null; 
shadow = null;

// assumptions
// table centered around 0,0
// table is at level z=0, so balls are translated by one BALL_RAD upwards


//CAMERA GLOBALS - SAM
var tracked_object_transform_matrix = Mat4.identity(); //Transform matrix of the object which the dynamic camera is following. The Cue is also aimed at this object
var dynamic_camera_radius = 15 * BALL_RAD; //How far from the object the dynamic camera floats
var dynamic_camera_tilt = Math.PI / 10; //0 rad looks at horizon, PI/4 rad looks straight down
var dynamic_camera_xy_angle = Math.PI / 2; //0 rad looks down +x axis, PI/2 looks down +y axis, PI looks down -x axis, 3PI/2 looks down -y axis
var static_camera_matrix = Mat4.look_at(Vec.of(0, 0, 400), Vec.of(0,0,0), Vec.of(0,1,0)); //Mat4.inverse(Mat4.translation([0, 30, 0]).times(Mat4.rotation(Math.PI/2, Vec.of(-1, 0, 0)))); //Location of the static top down camera
var selected_camera = 0; // 0=static, 1=dynamic_camera_angle
var camera_sensitivity = 0.01 //dynamic camera will rotate at a rate of dx * camera_sensitivity radians where dx=pixels traversed by cursor

//CUE & GAMESTATE GLOBALS - SAM
var hitting = false; //currently in the hit animation or balls still moving?
var hit_force = 0; //force when SPACE was pressed
var hit_anim_start = 0; //time from this.t when SPACE was pressed to begin the current action phase

// more gamestate globals
var cue_hit = false; // true if cue ball has been hit, ensuring cue ball gets hit only once per turn, set by draw_cue
var endTurn = false; // flags count of pocketed balls and game functions in the display loop, set by draw_cue


// gui variable
var gui;
function onLoad() {
    gui = new GUI();
    gui.setupGame();
}

//SOUND MANAGER - SAM
class SoundManager {
	constructor() {
		this.clinking_balls = [new Audio("assets/sounds/balls_colliding_1.ogg"), new Audio("assets/sounds/balls_colliding_2.ogg"), new Audio("assets/sounds/balls_colliding_3.ogg"), new Audio("assets/sounds/balls_colliding_4.ogg"), new Audio("assets/sounds/balls_colliding_5.ogg"), new Audio("assets/sounds/balls_colliding_6.ogg"), new Audio("assets/sounds/balls_colliding_7.ogg")];
		this.start_sound = new Audio("assets/sounds/start.ogg");
		this.pocket_sound = [new Audio("assets/sounds/pocket.ogg"), new Audio("assets/sounds/pocket.ogg"), new Audio("assets/sounds/pocket.ogg"), new Audio("assets/sounds/pocket.ogg")];
		this.cue_sound = new Audio("assets/sounds/cue_hit.ogg");
		this.wall_sound = [new Audio("assets/sounds/wall_hit_1.ogg"), new Audio("assets/sounds/wall_hit_1.ogg"), new Audio("assets/sounds/wall_hit_3.ogg"), new Audio("assets/sounds/wall_hit_2.ogg"), new Audio("assets/sounds/wall_hit_1.ogg"), new Audio("assets/sounds/wall_hit_2.ogg"), new Audio("assets/sounds/wall_hit_3.ogg")];
		this.clinking_balls[0].volume = 0.4;
		this.clinking_balls[1].volume = 0.4;
		this.clinking_balls[2].volume = 0.4;
		this.clinking_balls[3].volume = 0.4;
		this.clinking_balls[4].volume = 0.4;
		this.clinking_balls[5].volume = 0.4;
		this.clinking_balls[6].volume = 0.4;
		this.wall_sound[0].volume = 0.3;
		this.wall_sound[1].volume = 0.3;
		this.wall_sound[2].volume = 0.3;
		this.wall_sound[3].volume = 0.3;
		this.wall_sound[4].volume = 0.3;
		this.wall_sound[5].volume = 0.3;
		this.wall_sound[6].volume = 0.3;
		this.clink_index = 0;
		this.wall_index = 0;
		this.pocket_index = 0;
	}
	
	play_balls_clink() {
		this.clinking_balls[this.clink_index].play();
		this.clink_index = (this.clink_index + 1) % 7;
	}
	
	play_start_sound() {
		this.start_sound.play();
	}
	
	play_pocket_sound() {
		this.pocket_sound[this.pocket_index].play();
		this.pocket_index = (this.pocket_index + 1) % 4;
	}
	
	play_wall_sound() {
		this.wall_sound[this.wall_index].play();
		this.wall_index = (this.wall_index + 1) % 7;
	}
	
	play_cue_sound() {
		this.cue_sound.play();
	}
}
var soundmanager = new SoundManager();

// ball class
class Ball {
    // number = 0-15 (0=cue ball)
    constructor(number, shape, material, initPosX, initPosY) {
        this.number = number;

        this.pos = Vec.of(initPosX, initPosY, 0);

        this.velDir = Vec.of(0,0,0);
        this.speed = 0; // in units per tick
    
        this.shape = shape;
        this.material = material;
		
        // saves how much the ball has rotated
        this.rotateMatrix = Mat4.identity();
      
        // saves whether this ball should be drawn and collided with
        this.visible = true;

        // saves whether the ball is inside a pocket
        // -1 = not sinking
        // otherwise = index of pocket its sunk in
        this.sinking = -1;
    }

    // --------------- IMPORTANT FUNCTIONS TO CALL
	
    isStopped() {
        return this.speed == 0;
    }
    draw(graphics_state) {
        if (this.visible) {
			shadow.draw(graphics_state, Mat4.translation([this.modelTransform()[0][3], this.modelTransform()[1][3], this.modelTransform()[2][3] - BALL_RAD + 0.05 + this.number * 0.001]).times(Mat4.scale([8, 8, 8])), shadowmat);
            this.shape.draw(graphics_state, this.modelTransform(), this.material);
        }
    }
    setPos(newPos) {
        this.pos = newPos;
    }
    setVel(newVel) {
        this.speed = newVel.norm();

        if (this.speed == 0) {
            this.velDir = Vec.of(0,0,0);
        }
        else {
            this.velDir = newVel.normalized();
        }
    }
    // call this every display loop
    checkIfSinking() {
        for (let i = 0; i < POCKET_POSITIONS.length && this.sinking < 0 && this.visible; i++)
            if (this.pos.minus(POCKET_POSITIONS[i]).norm() <= POCKET_RAD)
                this.sinking = i;
    }
    // call this every display loop
    checkIfSunk() {
        if (this.visible && this.sinking >= 0 && this.pos[2] < -3 * BALL_RAD)
            return true;

        return false;
    }
    // call every display loop
    // force sinking ball to stay in pocket
    // includes collisions
    stayInPocket() {
        if (this.visible && this.sinking >= 0) {
            let pos = Vec.of(this.pos[0], this.pos[1], 0);
            let pocketPos = POCKET_POSITIONS[this.sinking];
            let realVel = this.velDir.times(this.speed);
            let vel2D = Vec.of(realVel[0], realVel[1], 0);

            // max allowable dist depends on height of ball
            let maxDist = POCKET_RAD;
            if (this.pos[2] >= -BALL_RAD && this.pos[2] <= 0) {
                let height = BALL_RAD + this.pos[2]; // height of ball center above table
                maxDist -= Math.sqrt(Math.pow(BALL_RAD, 2) - Math.pow(height, 2));
            }
            else {
                maxDist -= BALL_RAD;
            }

            if (pos.minus(pocketPos).norm() > maxDist) {
                let newPos2D = pocketPos.plus(pos.minus(pocketPos).normalized().times(0.98 * maxDist));
                this.pos = Vec.of(newPos2D[0], newPos2D[1], this.pos[2]);

                // change vel
                let radialOut = pos.minus(pocketPos).normalized();
                let projScalar = vel2D.dot(radialOut);

                if (projScalar > 0) {
                    let projection = radialOut.times(projScalar);
                    vel2D = vel2D.minus(projection.times(1.9));
                    this.setVel(Vec.of(vel2D[0], vel2D[1], realVel[2]));

                    soundmanager.play_wall_sound();
                }
            }
        }
    }


    // ---------------- INTERNAL HELPER FUNCTIONS
    modelTransform() {
        return Mat4.translation(Vec.of(0, 0, BALL_RAD))
                .times(Mat4.translation(this.pos))
                .times(this.rotateMatrix)
                .times(Mat4.scale(Vec.of(BALL_RAD, BALL_RAD, BALL_RAD)));
    }

    // accounts for rotation and deceleration
    physicsUpdate() {
        this.updateRotation();
        this.updateSpeed();
    }

    updateRotation() {
        if (this.speed != 0) {
            var rotationAxis = Vec.of(0,0,1).cross(this.velDir);
            this.rotateMatrix = Mat4.rotation(this.speed / BALL_RAD, rotationAxis).times(this.rotateMatrix);
        }
    }

    updateSpeed() { // call this last, after all position and rotation updates
        /* old friction method
        this.speed -= FRICTION_ACC;
        if (this.speed < 0) this.speed = 0;
        */
        
        if (this.speed <= FRICTION_MIN_SPEED)
            this.speed = 0;
        else
            this.speed *= FRICTION_SPEED_FRACTION;

        // add grav acceleration if ball sinking but not yet completely sunk
        if (this.visible && this.sinking >= 0) {
            // gravitational acceleration has less effect if the ball isn't completely in the pocket yet
            let pos = Vec.of(this.pos[0], this.pos[1], 0);
            let scale = (POCKET_RAD - pos.minus(POCKET_POSITIONS[this.sinking]).norm()) / BALL_RAD;
            if (scale < 0) scale = 0;
            if (scale > 1) scale = 1;
            // scale goes from 0 (on edge of pocket) to 1 (fully inside pocket)
            let grav_acc = scale * MAX_GRAV_ACC;



            let vel = this.velDir.times(this.speed);
            vel = vel.minus(Vec.of(0, 0, grav_acc));

            // update ball vars
            this.speed = vel.norm();
            this.velDir = vel.normalized();
        }
    }
}


// Ball collision detector
class BallCollider {
    constructor(ballArray) {
        this.balls = ballArray;
        this.collisions = [];
        this.pathSegments = [];
        
        // save initial positions
        this.initPositions = [];
        for (var i = 0; i < this.balls.length; i++) {
            this.initPositions.push(this.balls[i].pos);
        }
    }

	
    // -------------- IMPORTANT FUNCTIONS TO CALL
	
	// call this function to update ball positions by one time step
    updateBalls() {
        if (this.allBallsStopped()) 
            return;

        this.collide();
        
        for (var i = 0; i < this.balls.length; i++) {
            this.pathSegments[i].updateBall(this.balls[i]);
            this.balls[i].physicsUpdate();
        }
    }

    // returns true if all the balls are stationary
    allBallsStopped() {
        for (var i = 0; i < this.balls.length; i++) {
            if (!this.balls[i].isStopped())
                return false;
        }
        return true;
    }
    
    // return balls to initial positions, with zero velocity
    resetPositions() {
      for (var i = 0; i < this.balls.length; i++) {
        this.balls[i].setPos(this.initPositions[i]);
        this.balls[i].setVel(Vec.of(0,0,0));
        this.balls[i].visible = true;
      }
    }

	// ------------- INTERNAL HELPER FUNCTIONS

    collide() {
		this.loopCounter = 0;
        this.collisions = [];
        this.pathSegments = [];
        for (var i = 0; i < this.balls.length; i++) {
            var ball = this.balls[i];
            this.pathSegments.push(new PathSegment(ball.pos, ball.velDir.times(ball.speed), 1.0));
        }

        this.collectCollisions();

        while (this.collisions.length > 0 && this.loopCounter < 50) {

            this.computeCollision();
            this.collectCollisions();
			
			this.loopCounter++;
        }
    }

    // computes the first collision in the collision list, updating all path segments to after the collision
    // segment.collisionsRegistered should be true for all path segments
    // after adjusting a ball's PathSegment direction, it removes all collisions involving that ball, allowing them to be recalculated in collectCollisions()
	// also sets that collisionsRegistered to false for all segments involved in collision, since they have a new trajectory
    computeCollision() {
        var collision = this.collisions[0];
        
        // wall collision, x-dir
        if (collision.type == 1) {
            for (var i = 0; i < this.pathSegments.length; i++) {
                var segment = this.pathSegments[i];

                segment.pos = segment.pos.plus(segment.vel.times(collision.time));
                segment.timeDelta -= collision.time;

                if (collision.ballIndex == i) {
                    segment.vel[0] = -segment.vel[0];
                    segment.collisionsRegistered = false;
                }
            }

            this.removeCompletedCollision();
            this.removeCollisions(collision.ballIndex);
			soundmanager.play_wall_sound();
        }

        // wall collision, y-dir
        else if (collision.type == 2) {
            for (var i = 0; i < this.pathSegments.length; i++) {
                var segment = this.pathSegments[i];

                segment.pos = segment.pos.plus(segment.vel.times(collision.time));
                segment.timeDelta -= collision.time;

                if (collision.ballIndex == i) {
                    segment.vel[1] = -segment.vel[1];
                    segment.collisionsRegistered = false;
                }
            }

            this.removeCompletedCollision();
            this.removeCollisions(collision.ballIndex);
			soundmanager.play_wall_sound();
        }

        // ball-ball collisions
        else if (collision.type == 0) {
            for (var i = 0; i < this.pathSegments.length; i++) {
                var segment = this.pathSegments[i];

                segment.pos = segment.pos.plus(segment.vel.times(collision.time));
                segment.timeDelta -= collision.time;

                if (collision.ballIndex == i) {
                    // collision stuff
                    var seg1 = segment;
                    var seg2 = this.pathSegments[collision.ballIndex2];

                    var relVel = seg2.vel.minus(seg1.vel); // ball 2 velocity relative to ball 1

                    var normalVec = seg1.pos.minus(seg2.pos).normalized(); // direction vector from ball 2 to ball 1

                    var velChange = normalVec.times(COLLISION_FRACTION * relVel.dot(normalVec)); // component of ball 2 relative velocity pointing directly at ball 1 

                    seg1.vel = seg1.vel.plus(velChange);
                    seg2.vel = seg2.vel.minus(velChange);

                    seg1.collisionsRegistered = false;
                    seg2.collisionsRegistered = false;
                }
            }

            this.removeCompletedCollision();
            this.removeCollisions(collision.ballIndex);
            this.removeCollisions(collision.ballIndex2);
			soundmanager.play_balls_clink();
        }
    }

    // updates a list of collisions
    collectCollisions() {
        for (var i = 0; i < this.pathSegments.length; i++) {
            var segment = this.pathSegments[i];

            // dont compute collisions if collisions already computed or if ball invisible or if ball sinking
            if (this.balls[i].visible && this.balls[i].sinking < 0 && !segment.collisionsRegistered) {
                // wall collisions x
                var t = segment.timeOfWallCollisionX();
                if (t >= REWIND_MARGIN) {
                    this.addCollision(new Collision(t, 1, i));
                }

                // wall collisions y
                t = segment.timeOfWallCollisionY();
                if (t >= REWIND_MARGIN) {
                    this.addCollision(new Collision(t, 2, i));
                }


                // ball collisions
                for (var j = 0; j < this.pathSegments.length; j++) {
                    // only check collisions with pathsegments with collisionsRegistered = true - avoids double counting - this pathsegment (i) will become collisionsRegistered = true at the end of this loop
                    // also dont check collisions with invisible balls or sinking balls
                    var otherSegment = this.pathSegments[j];
                    if (i != j && this.balls[j].visible && this.balls[j].sinking < 0 && otherSegment.collisionsRegistered) {
                        t = segment.timeOfCollisionWith(otherSegment);
                        if (t >= REWIND_MARGIN) {
                            this.addCollision(new Collision(t, 0, i, j));
                        }
                    }
                }

                segment.collisionsRegistered = true;
            }
        }
    }

    // adds collision in correct time ordering
    // if times are equal, prioritize wall collisions
    addCollision(newCollision) {
        var t = newCollision.time;
        var j;
        for (j = 0; j < this.collisions.length && this.collisions[j].time < t; j++);

        if (newCollision.type == 0) // wall collisions before ball collisions if simultaneous
            for (; j < this.collisions.length && this.collisions[j].time == t && this.collisions[j].type != 0; j++);

        this.collisions.splice(j, 0, newCollision);
    }

    // removes the first collision, and updates the decrements all collision times by first collision time, so they will be relative to new time zero
    removeCompletedCollision() {
        var t = this.collisions[0].time;

        this.collisions.shift();

        for (var i = 0; i < this.collisions.length; i++) {
            this.collisions[i].time -= t;
        }
    }

    // removes all collisions involving a certain ball index
    removeCollisions(ballIndex) {
        for (var i = 0; i < this.collisions.length; i++) {
            if (this.collisions[i].ballIndex == ballIndex || this.collisions[i].ballIndex2 == ballIndex) {
                this.collisions.splice(i, 1);
                i--;
            }
        }
    }
}

class Collision {
    // time = time (in ticks) relative to start of tick
    // type = 0: ball collision, 1: wall collision x-dir, 2: wall collision y-dir
    constructor(time, type, ballIndex, ballIndex2=-1) {
        this.time = time;
        this.type = type;
        this.ballIndex = ballIndex;
        this.ballIndex2 = ballIndex2;
    }
}

class PathSegment {
    // position = initial position (vector) of ball at start of segment
    // velocity = velocity (vector) of ball during segment (units per tick)
    // timeDelta = time period of segment (in ticks): final position = pos + vel * timeDelta
    constructor(position, velocity, timeDelta) {
        this.pos = position;
        this.vel = velocity;
        this.timeDelta = timeDelta;
        this.collisionsRegistered = false;
    }

    finalPos() {
        return this.pos.plus(this.vel.times(this.timeDelta));
    }

    // updates position and velocity of Ball object with final position and velocity variables
    updateBall(ball) {
        ball.pos = this.finalPos();
        ball.speed = this.vel.norm();

        if (ball.speed == 0)
            ball.velDir = Vec.of(0,0,0);
        else
            ball.velDir = this.vel.normalized();
    }

    // returns negative if no collision within timeDelta
    timeOfWallCollisionX() {
        if (this.vel[0] == 0) 
            return -1;

        var t = (TABLE_WIDTH / 2 - BALL_RAD - this.pos[0]) / this.vel[0];
        if (t >= REWIND_MARGIN && t <= this.timeDelta && this.vel[0] > 0)
            return t;

        t = (-TABLE_WIDTH / 2 + BALL_RAD - this.pos[0]) / this.vel[0];
        if (t >= REWIND_MARGIN && t <= this.timeDelta && this.vel[0] < 0)
            return t;

        return -1;
    }

    timeOfWallCollisionY() {
        if (this.vel[1] == 0) return -1;

        var t = (TABLE_HEIGHT / 2 - BALL_RAD - this.pos[1]) / this.vel[1];
        if (t >= REWIND_MARGIN && t <= this.timeDelta && this.vel[1] > 0)
            return t;

        t = (-TABLE_HEIGHT / 2 + BALL_RAD - this.pos[1]) / this.vel[1];
        if (t >= REWIND_MARGIN && t <= this.timeDelta && this.vel[1] < 0)
            return t;
            
        return -1;
    }

    // returns time of collision with PathSegment 'other'
    // returns -1 if no collision within timeDelta
    // other = PathSegment reference
    // to support simultaneous wall and ball collisions, allow this to register collisions at t = 0
    timeOfCollisionWith(other) {
        var relVel = this.vel.minus(other.vel);
        var relPos = this.pos.minus(other.pos);
        
        var a = relVel.dot(relVel);
        var c = relPos.dot(relPos) - 4 * BALL_RAD * BALL_RAD;
        var b = 2 * relVel.dot(relPos);

        if (a == 0) return -1; // balls moving at same speed

        var det2 = b * b - 4 * a * c; // determinant squared
        if (det2 <= 0) return -1; // if the balls never meet, or exactly graze each other at one point

        var t = (-b - Math.sqrt(det2)) / (2 * a); // lower root represents entering the collision zone
		
        if (t < REWIND_MARGIN || t > this.timeDelta) // collision occurs outside of time step
            return -1;

        return t;
    }
}

//The maximum is exclusive and the minimum is inclusive
function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

window.Billiards_Game = window.classes.Billiards_Game =
    class Billiards_Game extends Scene_Component {
        constructor(context, control_box)
        {
            // The scene begins by requesting the camera, shapes, and materials it will need.
            super(context, control_box);

            const r = context.width / context.height;
            context.globals.graphics_state.projection_transform = Mat4.perspective(Math.PI / 4, r, .1, 1000);
			
			//MOUSE CONTROLS EVENTS - SAM
			//
			this.mouse_button_pressed = false;
			this.mouse_init_position = Vec.of(0, 0, 0);
			context.canvas.addEventListener("mousedown", e => {
                e.preventDefault();
				if(e.button == 0) {
					this.mouse_button_pressed = true;
					this.mouse_init_position = Vec.of(e.screenX, -e.screenY, 0);
				}
            });
			context.canvas.addEventListener("mouseup", e => {
                e.preventDefault();
				if(e.button == 0) {
					this.mouse_button_pressed = false;
				}
            });
			context.canvas.addEventListener("mousemove", e => {
                e.preventDefault();
                if(this.mouse_button_pressed) {
					//controls in dynamic camera mode
					if(selected_camera) {
						dynamic_camera_xy_angle = (dynamic_camera_xy_angle - e.movementX * camera_sensitivity) % (2*Math.PI);
					}
					//controls in static (top down) camera mode
					else {
						let cursorPos = Vec.of(e.screenX, -e.screenY, 0);
						let temp = cursorPos.minus(this.mouse_init_position);
						dynamic_camera_xy_angle = Math.atan2(temp[1], temp[0]);
					}
				}
            });

			//
			//END MOUSE CONTROLS EVENTS
			
            const shapes = {
                ball: new Subdivision_Sphere(5),
                cube: new Cube(),
				cue : 	new Cue(),
				tablelegs : 	new table_legs(),
				tablesides : 	new table_sides(),
				tabletop : 	new table_top(),
				tabletopedge : 	new table_top_edge(),
				tableunderside : 	new table_underside(),
				shadow : new Square()
            };
            this.submit_shapes(context, shapes);
			shadow = this.shapes.shadow;
            // Make some Material objects available to you:
            this.materials =
                {
                	balls: [
                	    // Cue ball at position 0 and X ball at position X
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/cueball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/1ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/2ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/3ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/4ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/5ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/6ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/7ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/8ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/9ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/10ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/11ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/12ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/13ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/14ball.jpg", true)}),
						context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient:0.8, specularity: 0.2, diffusivity: 0.5, texture:context.get_instance("assets/ball_textures/15ball.jpg", true)})
                	],
					cue: context.get_instance(Phong_Shader).material(
						Color.of(0, 0, 0, 1), {
							ambient: 1,
							texture: context.get_instance("assets/models/cue_stick/cue_stick.png")
						}
					),
                    felt: context.get_instance(Phong_Shader).material(Color.of(0,0.86500,0.01821,1), {ambient:0.1, diffusivity: 0.5, specularity: 0.1}),
                    steel: context.get_instance(Phong_Shader).material(Color.of(0.8,0.8,0.8,1), {ambient:0.1, diffusivity: 0.2, specularity: 1}),
                    wood: context.get_instance(Phong_Shader).material(Color.of(0.545,0.322,0.176,1), {ambient:0.1, diffusivity: 0.5, specularity: 0.5}),
					shadow: context.get_instance(Phong_Shader).material(Color.of(0,0,0,0.75), {ambient:1, texture:context.get_instance("assets/ball_textures/shadow.png", true)}),
                    default: context.get_instance(Phong_Shader).material(Color.of(1,1,1,1), {ambient: 1})
                };
			shadowmat = this.materials.shadow;
            this.lights = [new Light(Vec.of(0, 0, 50, 1), Color.of(1, 1, 1, 1), 1e6), new Light(Vec.of(0, 50, 50, 1), Color.of(1, 1, 1, 1), 1e6), new Light(Vec.of(0, -50, 50, 1), Color.of(1, 1, 1, 1), 1e6), new Light(Vec.of(0, 50, 0, 1), Color.of(1, 1, 1, 1), 1e8), new Light(Vec.of(0, 50, 0, 1), Color.of(1, 1, 1, 1), 1e8)];

            // Determine setup of the balls
            // 8 ball is placed in center of rack (middle of third row)
            // One corner ball must be striped and the other solid
            // The rest of the balls are placed randomly

            let nums = new Set(shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15])),
              leftCorner = 0,
              rightCorner = 0;

            if (getRandomInt(0,2) == 1) {

              leftCorner = getRandomInt(1,8);
              rightCorner = getRandomInt(9,16);

              // Remove the corner balls from nums
              nums.delete(leftCorner);
              nums.delete(rightCorner);
            }
            else {
              leftCorner = getRandomInt(9,16);
              rightCorner = getRandomInt(1,8);

              // Remove the corner balls from nums
              nums.delete(leftCorner);
              nums.delete(rightCorner);
            }

            let randNums = [],
              i = nums.length,
              j = 0;

			let it = nums.values();
			let temp = null;
            do {
				temp = it.next();
            	randNums.push(temp.value);
            } while(!temp.done);

            // list of balls
            let yDisplacement = TABLE_HEIGHT / 4;
            this.balls = [
                            new Ball(0, this.shapes.ball, this.materials.balls[0], 0, -30),
                            new Ball(randNums[0], this.shapes.ball, this.materials.balls[randNums[0]], 0, yDisplacement),
                            new Ball(randNums[1], this.shapes.ball, this.materials.balls[randNums[1]], 1.2 * BALL_RAD, 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[2], this.shapes.ball, this.materials.balls[randNums[2]], -1.2 * BALL_RAD, 1.8 * BALL_RAD + yDisplacement),
                            new Ball(8, this.shapes.ball, this.materials.balls[8], 0, 2 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[3], this.shapes.ball, this.materials.balls[randNums[3]],  -2 * 1.2 * BALL_RAD, 2 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[4], this.shapes.ball, this.materials.balls[randNums[4]], 2 * 1.2 * BALL_RAD, 2 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[5], this.shapes.ball, this.materials.balls[randNums[5]], -1 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[6], this.shapes.ball, this.materials.balls[randNums[6]], 1 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[7], this.shapes.ball, this.materials.balls[randNums[7]], -3 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[8], this.shapes.ball, this.materials.balls[randNums[8]], 3 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[9], this.shapes.ball, this.materials.balls[randNums[9]], 0, 4 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[10], this.shapes.ball, this.materials.balls[randNums[10]], -2 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(randNums[11], this.shapes.ball, this.materials.balls[randNums[11]], 2 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(leftCorner, this.shapes.ball, this.materials.balls[leftCorner], -4 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD + yDisplacement),
                            new Ball(rightCorner, this.shapes.ball, this.materials.balls[rightCorner], 4 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD + yDisplacement)
                        ];

            // handler for ball position updates
            // saves initial positions, allowing balls to easily be replaced
            this.ballCollider = new BallCollider(this.balls);

            // stores ball numbers that have been sunk (in order) in any one turn
            this.sunkBallNums = [];

            // time variable
            this.t = 0;
        }

		//CAMERA AND CUE CODE - SAM
		//
		//Attaches cue to the dynamically tracked object (cue ball) and places the camera. call this every frame at the very end
		update_camera(graphics_state) {
			if(selected_camera) {
				let obj_coords = this.balls[0].pos.plus(Vec.of(0,0,BALL_RAD));
				let cam_z = Math.sin(dynamic_camera_tilt) * dynamic_camera_radius + obj_coords[2];
				let cam_y = -Math.sin(dynamic_camera_xy_angle) * Math.cos(dynamic_camera_tilt) * dynamic_camera_radius + obj_coords[1];
				let cam_x = -Math.cos(dynamic_camera_xy_angle) * Math.cos(dynamic_camera_tilt) * dynamic_camera_radius + obj_coords[0];
				graphics_state.camera_transform = Mat4.look_at(Vec.of(cam_x, cam_y, cam_z), obj_coords, Vec.of(0, 0, 1));
			}
			else {
				graphics_state.camera_transform = static_camera_matrix;
			}
			this.draw_cue(graphics_state);
		}
		
		//returns a force for the pool cue between 0 and 1 inclusive
		get_current_force_value() {
			return 0.5 + 0.5 * Math.sin(Math.PI*this.t);
		}

		/**
		//draws pool cue (called by update_camera)
		draw_cue(graphics_state) {
            let cue_transform = Mat4.identity();
            //play the standard animation while player aims
            if (!hitting) {
                cue_transform = Mat4.translation([tracked_object_transform_matrix[0][3], tracked_object_transform_matrix[1][3], tracked_object_transform_matrix[2][3]]).times(Mat4.rotation(dynamic_camera_xy_angle, Vec.of(0, 1, 0))).times(Mat4.translation([0, 0, 2 * this.get_current_force_value() + 1.5])).times(Mat4.scale([.25, .25, 5])).times(Mat4.translation([0, 0, 1]));
            } else {
                //striking animation
                if (this.t - hit_anim_start < 0.1) {
                    cue_transform = Mat4.translation([tracked_object_transform_matrix[0][3], tracked_object_transform_matrix[1][3], tracked_object_transform_matrix[2][3]]).times(Mat4.rotation(dynamic_camera_xy_angle, Vec.of(0, 1, 0))).times(Mat4.translation([0, 0, (0.1 - this.t + hit_anim_start) / 0.1 * 2 * hit_force + 1.5])).times(Mat4.scale([.25, .25, 5])).times(Mat4.translation([0, 0, 1]));
                }
                //hold cue in place after strike(can also warp it below the table)
                else {
                    cue_transform = Mat4.translation([tracked_object_transform_matrix[0][3], tracked_object_transform_matrix[1][3], tracked_object_transform_matrix[2][3]]).times(Mat4.rotation(dynamic_camera_xy_angle, Vec.of(0, 1, 0))).times(Mat4.translation([0, 0, 1.5])).times(Mat4.scale([.25, .25, 5])).times(Mat4.translation([0, 0, 1]));
                }
                if (this.t - hit_anim_start > 1.5) {
                    if ()
                    hitting = false;
                }
            }
            // this.shapes.box.draw(graphics_state, cue_transform, this.plastic.override({color: this.cube_colors[4]}));
        }
         **/
		// redo of drawing pool cue, doesn't draw pool cue after instant of hitting cue ball
        // needed to change structure fairly drastically to integrate with adding velocity to cue ball only once
        // draws cue and handles waiting for balls to stop moving
		draw_cue(graphics_state) {
		    let cue_transform = Mat4.identity();
		    if (!hitting) {
                cue_transform = Mat4.translation(this.balls[0].pos)
                    .times(Mat4.translation(Vec.of(0,0,-1)))
                    .times(Mat4.rotation(dynamic_camera_xy_angle + Math.PI, Vec.of(0,0,1)))
                    .times(Mat4.rotation(Math.PI / 20, Vec.of(0,-1,0)))
                    .times(Mat4.translation([10 * this.get_current_force_value() + BALL_RAD, 0, BALL_RAD]))
                    .times(Mat4.scale([20, 20, 20]))
                    .times(Mat4.translation([0.7, 0, 0]));
                this.shapes.cue.draw(graphics_state, cue_transform, this.materials.cue);
		    }
		    else if (this.t - hit_anim_start < 0.1) {
                cue_transform = Mat4.translation(this.balls[0].pos)
                    .times(Mat4.translation(Vec.of(0,0,-1)))
                    .times(Mat4.rotation(dynamic_camera_xy_angle + Math.PI, Vec.of(0,0,1)))
                    .times(Mat4.rotation(Math.PI / 20, Vec.of(0,-1,0)))
                    .times(Mat4.translation([(0.1 - this.t + hit_anim_start) / 0.1 * 2 * 10 * hit_force + BALL_RAD, 0, BALL_RAD]))
                    .times(Mat4.scale([20, 20, 20]))
                    .times(Mat4.translation([0.7, 0, 0]));
                this.shapes.cue.draw(graphics_state, cue_transform, this.materials.cue);
		    }
		    else if (!cue_hit) {
		        this.hit_cue_ball();
		        cue_hit = true;
				soundmanager.play_cue_sound();
            }
		    else if (!endTurn && this.ballCollider.allBallsStopped()) {
		        endTurn = true;
            }
        }

        make_control_panel() {
			this.key_triggered_button("Change Camera", ["c"], () => {
				selected_camera = 1 - selected_camera;
			});
			this.key_triggered_button("Hit Ball", [" "], () => {
			    if(!hitting) {
					hitting = true;
					hit_anim_start = this.t;
					hit_force = this.get_current_force_value();
				}
			});
        }
		//
		//END CAMERA AND CUE CODE

        // adds velocity to cue ball using dynamic_camera_xy_angle and hit_force values
        hit_cue_ball() {
            this.balls[0].setVel(Mat4.rotation(dynamic_camera_xy_angle, Vec.of(0,0,1)).times(Vec.of(1, 0, 0, 0).times(MAX_HITTING_SPEED * hit_force)).to3());
        }



        display(graphics_state) {
            graphics_state.lights = this.lights;
            this.t += graphics_state.animation_delta_time / 1000;

            
            /* debug - draw pocket spheres
            for (let i = 0; i < POCKET_POSITIONS.length; i++) {
                this.shapes.ball.draw(graphics_state, Mat4.translation(POCKET_POSITIONS[i].minus(Vec.of(0,0,1))).times(Mat4.scale(Vec.of(POCKET_RAD, POCKET_RAD, 0.1))), this.materials.default.override({color: Color.of(1,1,1,0.25)}));
                this.shapes.cube.draw(graphics_state, Mat4.translation(POCKET_POSITIONS[i]).times(Mat4.scale(Vec.of(0.2, 0.2, 50))), this.materials.default);
            }*/
             
            
            //draw table
            this.shapes.tablelegs.draw(graphics_state, Mat4.translation([0, 0, 0]).times(Mat4.scale([112, 106, 110])).times(Mat4.rotation(Math.PI / 2, Vec.of(0, 0, 1))).times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0))).times(Mat4.translation([0, -0.9, 0])), this.materials.steel);
            this.shapes.tablesides.draw(graphics_state, Mat4.translation([0, 0, 0]).times(Mat4.scale([112, 106, 110])).times(Mat4.rotation(Math.PI / 2, Vec.of(0, 0, 1))).times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0))).times(Mat4.translation([-0.35, -0.25, -0.45])).times(Mat4.scale([0.75, 0.75, 0.75])), this.materials.wood);
            this.shapes.tabletop.draw(graphics_state,  Mat4.translation([0, 0, -0.15]).times(Mat4.scale([120, 110, 112])).times(Mat4.rotation(Math.PI / 2, Vec.of(0, 0, 1))).times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0))), this.materials.steel);
            this.shapes.tabletopedge.draw(graphics_state,  Mat4.translation([0, 0, 0]).times(Mat4.scale([112, 106, 110])).times(Mat4.rotation(Math.PI / 2, Vec.of(0, 0, 1))).times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0))).times(Mat4.scale([1.25, 1.25, 1.25])), this.materials.felt);



            this.ballCollider.updateBalls(); // invisible balls dont collide, sinking balls dont collide in this function
            // check if balls hit pockets, make them invisible and adding them to this.sunkBallNums if they have
            // make sure balls stay in pockets, colliding them against pocket walls
            // draw balls
            for (let i = 0; i < this.balls.length; i++) {
                this.balls[i].checkIfSinking(); // sets sinking flag if ball is in pocket, this will make it fall downward and only collide with pocket walls

                // ensure that sinking balls stay in pocket
                this.balls[i].stayInPocket();

                if (this.balls[i].checkIfSunk()) { // check if ball has fallen low enough, in which case it returns true
                    this.balls[i].visible = false;
                    this.balls[i].sinking = -1;
                    this.balls[i].setPos(Vec.of(0, 0, 10));
                    this.balls[i].setVel(Vec.of(0, 0, 0));
                    this.sunkBallNums.push(this.balls[i].number);
                    soundmanager.play_pocket_sound();
                }

                this.balls[i].draw(graphics_state);
            }


            // check if turn over
            if (endTurn) {
                let gameOver = gui.game.pocketedBalls(this.sunkBallNums);

                // reset cue ball if it was sunk
                if (this.sunkBallNums.includes(0)) {
                    this.balls[0].setPos(Vec.of(0, -30, 0));
                    this.balls[0].setVel(Vec.of(0,0,0));
                    this.balls[0].visible = true;
                }

                // if game over, reset all balls
                if (gameOver) {
                    this.ballCollider.resetPositions();
                    gui.setupGame();
                }

                // reset flags and turn vars
                this.sunkBallNums = [];
                cue_hit = false;
                hitting = false;
                endTurn = false;
            }

            this.update_camera(graphics_state);           
        }
    };
