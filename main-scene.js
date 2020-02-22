// billiards constants
const BALL_RAD = 3;
const TABLE_WIDTH = BALL_RAD * 6 * 3;
const TABLE_HEIGHT = BALL_RAD * 6 * 7;

// const FRICTION_ACC = 0.01; // units per tick^2 - looks unnatural
const FRICTION_SPEED_FRACTION = 0.99; // each tick, the speed of each ball is multiplied by this coefficient
const FRICTION_MIN_SPEED = 0.01; // at this speed, friction will immediately stop the ball

const COLLISION_FRACTION = 0.99; // the amount of relative velocity components that colliding balls exchange
// lowering this beyond its maximum of 1 has the effect of lowering average kinetic energy while still conserving momentum of a collision
// seems to make collisions look a little more realistic - might simulate effects of rolling balls

const REWIND_MARGIN = -1e-6 // allows previous collision times to be detected and time rewound up to this amount
// due to floating point error for collisions that happen almost simultaneously

// assumptions
// table centered around 0,0
// table is at level z=0, so balls are translated by one BALL_RAD upwards


// ball class
class Ball {
    constructor(shape, material, initPosX, initPosY) {
        this.pos = Vec.of(initPosX, initPosY, 0);

        this.velDir = Vec.of(0,0,0);
        this.speed = 0; // in units per tick
    
        this.shape = shape;
        this.material = material;

        // saves how much the ball has rotated
        this.rotateMatrix = Mat4.identity();
    }

    // --------------- IMPORTANT FUNCTIONS TO CALL
	
    isStopped() {
        return this.speed == 0;
    }
    draw(graphics_state) {
        this.shape.draw(graphics_state, this.modelTransform(), this.material);
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
    }
}


// Ball collision detector
class BallCollider {
    constructor(ballArray) {
        this.balls = ballArray;
        this.collisions = [];
        this.pathSegments = [];
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
			// debug
			/*
			for (var i = 0; i < this.collisions.length; i++) {
				console.log(this.collisions[i].time + ", " + this.collisions[i].type + ", ", this.collisions[i].ballIndex + ", " + this.collisions[i].ballIndex2 + "\n");
			}
			console.log("\n");
			*/

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
        }
    }

    // updates a list of collisions
    collectCollisions() {
        for (var i = 0; i < this.pathSegments.length; i++) {
            var segment = this.pathSegments[i];

            if (!segment.collisionsRegistered) {

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
                    var otherSegment = this.pathSegments[j];
                    if (i != j && otherSegment.collisionsRegistered) {
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



window.Assignment_Three_Scene = window.classes.Assignment_Three_Scene =
    class Assignment_Three_Scene extends Scene_Component {
        constructor(context, control_box)
        {
            // The scene begins by requesting the camera, shapes, and materials it will need.
            super(context, control_box);
            // First, include a secondary Scene that provides movement controls:
            if (!context.globals.has_controls)
                context.register_scene_component(new Movement_Controls(context, control_box.parentElement.insertCell()));

            context.globals.graphics_state.camera_transform = Mat4.look_at(Vec.of(0, -100, 100), Vec.of(0, 0, 0), Vec.of(0, 1, 0));
            this.initial_camera_location = Mat4.inverse(context.globals.graphics_state.camera_transform);

            const r = context.width / context.height;
            context.globals.graphics_state.projection_transform = Mat4.perspective(Math.PI / 4, r, .1, 1000);

            const shapes = {
                torus: new Torus(15, 15),
                torus2: new (Torus.prototype.make_flat_shaded_version())(15, 15),
                ball: new Subdivision_Sphere(5)

                // TODO:  Fill in as many additional shape instances as needed in this key/value table.
                //        (Requirement 1)
            };
            this.submit_shapes(context, shapes);

            // Make some Material objects available to you:
            this.materials =
                {
                    test: context.get_instance(Phong_Shader).material(Color.of(1, 1, 0, 1), {ambient: .2}),
                    ring: context.get_instance(Ring_Shader).material()

                    // TODO:  Fill in as many additional material objects as needed in this key/value table.
                    //        (Requirement 1)
                };

            this.lights = [new Light(Vec.of(0, 0, 20, 1), Color.of(0, 1, 1, 1), 1000)];


            // list of balls
            this.balls = [
                            new Ball(this.shapes.ball, this.materials.test, 0, -30),
                            new Ball(this.shapes.ball, this.materials.test, 0, 0),
                            new Ball(this.shapes.ball, this.materials.test, 1.2 * BALL_RAD, 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, -1.2 * BALL_RAD, 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 0, 2 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test,  -2 * 1.2 * BALL_RAD, 2 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 2 * 1.2 * BALL_RAD, 2 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, -1 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 1 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, -3 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 3 * 1.2 * BALL_RAD, 3 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 0, 4 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, -2 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 2 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, -4 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD),
                            new Ball(this.shapes.ball, this.materials.test, 4 * 1.2 * BALL_RAD, 4 * 1.8 * BALL_RAD)
                        ];

            // handler for ball position updates
            this.ballCollider = new BallCollider(this.balls);

            // debug - hit cue ball
            this.balls[0].setVel(Vec.of(0, 5, 0));
        }

        make_control_panel() {
            // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
            this.key_triggered_button("View solar system", ["0"], () => this.attached = () => this.initial_camera_location);
            this.new_line();
            this.key_triggered_button("Attach to planet 1", ["1"], () => this.attached = () => this.planet_1);
            this.key_triggered_button("Attach to planet 2", ["2"], () => this.attached = () => this.planet_2);
            this.new_line();
            this.key_triggered_button("Attach to planet 3", ["3"], () => this.attached = () => this.planet_3);
            this.key_triggered_button("Attach to planet 4", ["4"], () => this.attached = () => this.planet_4);
            this.new_line();
            this.key_triggered_button("Attach to planet 5", ["5"], () => this.attached = () => this.planet_5);
            this.key_triggered_button("Attach to moon", ["m"], () => this.attached = () => this.moon);
        }

        display(graphics_state) {
            graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
            const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;


            // TODO:  Fill in matrix operations and drawing code to draw the solar system scene (Requirements 2 and 3)


            //this.shapes.torus2.draw(graphics_state, Mat4.identity(), this.materials.test);

            this.ballCollider.updateBalls();
            // console.log(this.balls[0].pos + "\n");
            for (var i = 0; i < this.balls.length; i++) {
                this.balls[i].draw(graphics_state);
            }
        }
    };


// Extra credit begins here (See TODO comments below):

window.Ring_Shader = window.classes.Ring_Shader =
    class Ring_Shader extends Shader {
        // Subclasses of Shader each store and manage a complete GPU program.
        material() {
            // Materials here are minimal, without any settings.
            return {shader: this}
        }

        map_attribute_name_to_buffer_name(name) {
            // The shader will pull single entries out of the vertex arrays, by their data fields'
            // names.  Map those names onto the arrays we'll pull them from.  This determines
            // which kinds of Shapes this Shader is compatible with.  Thanks to this function,
            // Vertex buffers in the GPU can get their pointers matched up with pointers to
            // attribute names in the GPU.  Shapes and Shaders can still be compatible even
            // if some vertex data feilds are unused.
            return {object_space_pos: "positions"}[name];      // Use a simple lookup table.
        }

        // Define how to synchronize our JavaScript's variables to the GPU's:
        update_GPU(g_state, model_transform, material, gpu = this.g_addrs, gl = this.gl) {
            const proj_camera = g_state.projection_transform.times(g_state.camera_transform);
            // Send our matrices to the shader programs:
            gl.uniformMatrix4fv(gpu.model_transform_loc, false, Mat.flatten_2D_to_1D(model_transform.transposed()));
            gl.uniformMatrix4fv(gpu.projection_camera_transform_loc, false, Mat.flatten_2D_to_1D(proj_camera.transposed()));
        }

        shared_glsl_code()            // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        {
            return `precision mediump float;
              varying vec4 position;
              varying vec4 center;
      `;
        }

        vertex_glsl_code()           // ********* VERTEX SHADER *********
        {
            return `
        attribute vec3 object_space_pos;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_transform;

        void main()
        { 
        }`;           // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
        }

        fragment_glsl_code()           // ********* FRAGMENT SHADER *********
        {
            return `
        void main()
        { 
        }`;           // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        }
    };

window.Grid_Sphere = window.classes.Grid_Sphere =
    class Grid_Sphere extends Shape           // With lattitude / longitude divisions; this means singularities are at
    {
        constructor(rows, columns, texture_range)             // the mesh's top and bottom.  Subdivision_Sphere is a better alternative.
        {
            super("positions", "normals", "texture_coords");
            // TODO:  Complete the specification of a sphere with lattitude and longitude lines
            //        (Extra Credit Part III)
        }
    };