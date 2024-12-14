let defaultViewMatrix = [-1,0,0,0,
    0,-1,0,0,
    0,0,1,0,
    0,0,0,1];

let yaw = 0;   // Rotation around the Y-axis
let pitch = 0; // Rotation around the X-axis
let movement =  [0, 0, 0]; // Movement vector initialized to 0,0,0

let viewMatrix = defaultViewMatrix;
let socket;
let currentCameraIndex = 0;
let projectionMatrix;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d');
const canvas_viz = document.getElementById("canvas-viz");
const ctx_viz = canvas_viz.getContext('2d');
const serverConnect = document.getElementById("server-connect");
const fps = document.getElementById("fps");
const iter_number = document.getElementById("iter-number");
const camid = document.getElementById("camid");
const focal_x = document.getElementById("focal-x");
const focal_y = document.getElementById("focal-y");
const inner_width = document.getElementById("inner-width");
const inner_height = document.getElementById("inner-height");
const send_button = document.getElementById("send-button");
const prompt_box = document.getElementById("prompt-box");

const cameras = [
    {
        id: 0,
        position: [
            0, 0, 0   // +left, +up, +forward
        ],
        rotation: [
            [-1, 0, 0],
            [0., -1, 0],
            [0, 0, 1],
        ],
        fy: 1000,
        fx: 1000,
        yaw: 0,
        pitch: 0,
        movement: [0, 0, 0],
    },
];

function getViewMatrix(camera) {
    const R = camera.rotation.flat();
    const t = camera.position;
    const camToWorld = [
        [R[0], R[1], R[2], 0],
        [R[3], R[4], R[5], 0],
        [R[6], R[7], R[8], 0],
        [
            -t[0] * R[0] - t[1] * R[3] - t[2] * R[6],
            -t[0] * R[1] - t[1] * R[4] - t[2] * R[7],
            -t[0] * R[2] - t[1] * R[5] - t[2] * R[8],
            1,
        ],
    ].flat();
    return camToWorld;
}

function multiply4(a, b) {
    return [
        b[0] * a[0] + b[1] * a[4] + b[2] * a[8] + b[3] * a[12],
        b[0] * a[1] + b[1] * a[5] + b[2] * a[9] + b[3] * a[13],
        b[0] * a[2] + b[1] * a[6] + b[2] * a[10] + b[3] * a[14],
        b[0] * a[3] + b[1] * a[7] + b[2] * a[11] + b[3] * a[15],
        b[4] * a[0] + b[5] * a[4] + b[6] * a[8] + b[7] * a[12],
        b[4] * a[1] + b[5] * a[5] + b[6] * a[9] + b[7] * a[13],
        b[4] * a[2] + b[5] * a[6] + b[6] * a[10] + b[7] * a[14],
        b[4] * a[3] + b[5] * a[7] + b[6] * a[11] + b[7] * a[15],
        b[8] * a[0] + b[9] * a[4] + b[10] * a[8] + b[11] * a[12],
        b[8] * a[1] + b[9] * a[5] + b[10] * a[9] + b[11] * a[13],
        b[8] * a[2] + b[9] * a[6] + b[10] * a[10] + b[11] * a[14],
        b[8] * a[3] + b[9] * a[7] + b[10] * a[11] + b[11] * a[15],
        b[12] * a[0] + b[13] * a[4] + b[14] * a[8] + b[15] * a[12],
        b[12] * a[1] + b[13] * a[5] + b[14] * a[9] + b[15] * a[13],
        b[12] * a[2] + b[13] * a[6] + b[14] * a[10] + b[15] * a[14],
        b[12] * a[3] + b[13] * a[7] + b[14] * a[11] + b[15] * a[15],
    ];
}

function invert4(a) {
    let b00 = a[0] * a[5] - a[1] * a[4];
    let b01 = a[0] * a[6] - a[2] * a[4];
    let b02 = a[0] * a[7] - a[3] * a[4];
    let b03 = a[1] * a[6] - a[2] * a[5];
    let b04 = a[1] * a[7] - a[3] * a[5];
    let b05 = a[2] * a[7] - a[3] * a[6];
    let b06 = a[8] * a[13] - a[9] * a[12];
    let b07 = a[8] * a[14] - a[10] * a[12];
    let b08 = a[8] * a[15] - a[11] * a[12];
    let b09 = a[9] * a[14] - a[10] * a[13];
    let b10 = a[9] * a[15] - a[11] * a[13];
    let b11 = a[10] * a[15] - a[11] * a[14];
    let det =
        b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    return [
        (a[5] * b11 - a[6] * b10 + a[7] * b09) / det,
        (a[2] * b10 - a[1] * b11 - a[3] * b09) / det,
        (a[13] * b05 - a[14] * b04 + a[15] * b03) / det,
        (a[10] * b04 - a[9] * b05 - a[11] * b03) / det,
        (a[6] * b08 - a[4] * b11 - a[7] * b07) / det,
        (a[0] * b11 - a[2] * b08 + a[3] * b07) / det,
        (a[14] * b02 - a[12] * b05 - a[15] * b01) / det,
        (a[8] * b05 - a[10] * b02 + a[11] * b01) / det,
        (a[4] * b10 - a[5] * b08 + a[7] * b06) / det,
        (a[1] * b08 - a[0] * b10 - a[3] * b06) / det,
        (a[12] * b04 - a[13] * b02 + a[15] * b00) / det,
        (a[9] * b02 - a[8] * b04 - a[11] * b00) / det,
        (a[5] * b07 - a[4] * b09 - a[6] * b06) / det,
        (a[0] * b09 - a[1] * b07 + a[2] * b06) / det,
        (a[13] * b01 - a[12] * b03 - a[14] * b00) / det,
        (a[8] * b03 - a[9] * b01 + a[10] * b00) / det,
    ];
}

function rotate4(a, rad, x, y, z) {
    let len = Math.hypot(x, y, z);
    x /= len;
    y /= len;
    z /= len;
    let s = Math.sin(rad);
    let c = Math.cos(rad);
    let t = 1 - c;
    let b00 = x * x * t + c;
    let b01 = y * x * t + z * s;
    let b02 = z * x * t - y * s;
    let b10 = x * y * t - z * s;
    let b11 = y * y * t + c;
    let b12 = z * y * t + x * s;
    let b20 = x * z * t + y * s;
    let b21 = y * z * t - x * s;
    let b22 = z * z * t + c;
    return [
        a[0] * b00 + a[4] * b01 + a[8] * b02,
        a[1] * b00 + a[5] * b01 + a[9] * b02,
        a[2] * b00 + a[6] * b01 + a[10] * b02,
        a[3] * b00 + a[7] * b01 + a[11] * b02,
        a[0] * b10 + a[4] * b11 + a[8] * b12,
        a[1] * b10 + a[5] * b11 + a[9] * b12,
        a[2] * b10 + a[6] * b11 + a[10] * b12,
        a[3] * b10 + a[7] * b11 + a[11] * b12,
        a[0] * b20 + a[4] * b21 + a[8] * b22,
        a[1] * b20 + a[5] * b21 + a[9] * b22,
        a[2] * b20 + a[6] * b21 + a[10] * b22,
        a[3] * b20 + a[7] * b21 + a[11] * b22,
        ...a.slice(12, 16),
    ];
}

function translate4(a, x, y, z) {
    return [
        ...a.slice(0, 12),
        a[0] * x + a[4] * y + a[8] * z + a[12],
        a[1] * x + a[5] * y + a[9] * z + a[13],
        a[2] * x + a[6] * y + a[10] * z + a[14],
        a[3] * x + a[7] * y + a[11] * z + a[15],
    ];
}

const use_extrinsics = (camera) => {
    // viewMatrix = getViewMatrix(camera);
    yaw = camera.yaw;
    pitch = camera.pitch;
    movement = camera.movement;
    // defaultViewMatrix = viewMatrix;
};

const use_camera = (camera) => {
    // use_intrinsics(camera);
    use_extrinsics(camera);
};

const update_displayed_info = (camera) => {
    camid.innerText = "cam  " + currentCameraIndex;
    focal_x.innerText = "focal_x  " + camera.fx;
    focal_y.innerText = "focal_y  " + camera.fy;
    inner_width.innerText = "inner_width  " + innerWidth;
    inner_height.innerText = "inner_height  " + innerHeight;
};

function connectToServer() {
    socket = io.connect('http://localhost:7777/');
    // socket = io.connect('http://localhost:8000/');

    socket.on('connect', () => {
        console.log("Connected to server.");
        serverConnect.innerText = "Connected to server. Server initializing...";
    });

    socket.on('connect_error', () => {
        console.log("Connection failed.");
        serverConnect.innerText = "Connection to server failed. Please retry.";
    });
    
    socket.on('frame', (data) => {
        // Receive the rendered image data from the server
        const blob = new Blob([data], { type: 'image/jpeg' });
        const imageURL = URL.createObjectURL(blob);

        // Update the canvas with the received image
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(imageURL);
        };
        img.src = imageURL;
    });

    socket.on('viz', (data) => {
        // Receive the rendered image data from the server
        const blob = new Blob([data], { type: 'image/jpeg' });
        const imageURL = URL.createObjectURL(blob);

        // Update the canvas with the received image
        const img = new Image();
        img.onload = () => {
            ctx_viz.drawImage(img, 0, 0, canvas_viz.width, canvas_viz.height);
            URL.revokeObjectURL(imageURL);
        };
        img.src = imageURL;
    });

    socket.on('server-state', (msg) => {
        console.log(msg);
        serverConnect.innerText = msg;
    });

    socket.on('iter-number', (msg) => {
        iter_number.innerText = msg;
    });

    socket.on('scene-prompt', (msg) => {
        console.log(msg);
        prompt_box.value = msg;
    });
}

function sendCameraPose() {
    if (socket && socket.connected) {
        socket.emit('render-pose', viewMatrix);
    }
}

function extractPositionFromViewMatrix(matrix) {
    return [matrix[12], matrix[13], -matrix[14]];
}

function extractRotationFromViewMatrix(matrix) {
    return [
        [matrix[0], matrix[1], matrix[2]],
        [matrix[4], matrix[5], matrix[6]],
        [matrix[8], matrix[9], matrix[10]]
    ];
}

function storeCameraPose(matrix, yaw, pitch, movement) {
    const newPosition = extractPositionFromViewMatrix(matrix);
    const newRotation = extractRotationFromViewMatrix(matrix);
    
    const camera_tmp = {
        id: cameras.length,
        position: newPosition,
        rotation: newRotation,
        fy: 1000,
        fx: 1000,
        yaw: yaw,
        pitch: pitch,
        movement: movement
    };
    console.log("camera_length: " + cameras.length);
    cameras.push(camera_tmp);
    if (cameras.length > 10) {
        console.log("camera_length exeeded: " + cameras.length);
        cameras.splice(1, 1);
    }
}

// Main function
async function main() {
    connectToServer();
    let active_camera = JSON.parse(JSON.stringify(cameras[0]));  // deep copy
    update_displayed_info(active_camera);

    send_button.addEventListener("click", () => {
        socket.emit('scene-prompt', prompt_box.value);
    });

    let activeKeys = [];
    window.addEventListener("keydown", (e) => {
        if (document.activeElement != document.body) return;
        if (e.code === "KeyI") {
            socket.emit('start', 'start signal');  // Send start signal to the server
        }
        if (e.code === "KeyR") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            inv = translate4(inv, ...movement);

            // Apply rotations
            inv = rotate4(inv, yaw, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw;
            let pitch_tmp = pitch;
            let movement_tmp = movement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);

            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyQ") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            inv = translate4(inv, ...movement);

            // Apply rotations
            inv = rotate4(inv, yaw, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);

            console.log("viewMatrix: [" + viewMatrix + "]");
        }
        if (e.code === "KeyT") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            
            let backwardMovement = [0, 0, -0.8];
            let combinedMovement = [
                movement[0] + backwardMovement[0],
                movement[1] + backwardMovement[1],
                movement[2] + backwardMovement[2]
            ];

            inv = translate4(inv, ...combinedMovement);

            // Apply rotations
            inv = rotate4(inv, yaw, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw;
            let pitch_tmp = pitch;
            let movement_tmp = combinedMovement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);

            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyY") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            let leftTurnAngle = 20 * Math.PI / 180;

            inv = translate4(inv, ...movement);

            // Apply rotations
            inv = rotate4(inv, yaw - leftTurnAngle, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw - leftTurnAngle;
            let pitch_tmp = pitch;
            let movement_tmp = movement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);

            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyU") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            let rightTurnAngle = 20 * Math.PI / 180;

            inv = translate4(inv, ...movement);

            // Apply rotations
            inv = rotate4(inv, yaw + rightTurnAngle, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw + rightTurnAngle;
            let pitch_tmp = pitch;
            let movement_tmp = movement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);

            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyI") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            let leftTurnAngle = 15 * Math.PI / 180;

            let backwardMovement = [0, 0, -0.5];
            let combinedMovement = [
                movement[0] + backwardMovement[0],
                movement[1] + backwardMovement[1],
                movement[2] + backwardMovement[2]
            ];

            inv = translate4(inv, ...combinedMovement);

            // Apply rotations
            inv = rotate4(inv, yaw - leftTurnAngle, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw - leftTurnAngle;
            let pitch_tmp = pitch;
            let movement_tmp = combinedMovement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);

            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyO") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            let rightTurnAngle = 15 * Math.PI / 180;

            let backwardMovement = [0, 0, -0.5];
            let combinedMovement = [
                movement[0] + backwardMovement[0],
                movement[1] + backwardMovement[1],
                movement[2] + backwardMovement[2]
            ];

            inv = translate4(inv, ...combinedMovement);

            // Apply rotations
            inv = rotate4(inv, yaw + rightTurnAngle, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw + rightTurnAngle;
            let pitch_tmp = pitch;
            let movement_tmp = combinedMovement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);
            
            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyK") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            let leftTurnAngle = 15 * Math.PI / 180;

            let backwardMovement = [0, 0, 0.5];
            let combinedMovement = [
                movement[0] + backwardMovement[0],
                movement[1] + backwardMovement[1],
                movement[2] + backwardMovement[2]
            ];

            inv = translate4(inv, ...combinedMovement);

            // Apply rotations
            inv = rotate4(inv, yaw - leftTurnAngle, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw - leftTurnAngle;
            let pitch_tmp = pitch;
            let movement_tmp = combinedMovement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);

            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyL") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            let rightTurnAngle = 15 * Math.PI / 180;

            let backwardMovement = [0, 0, 0.5];
            let combinedMovement = [
                movement[0] + backwardMovement[0],
                movement[1] + backwardMovement[1],
                movement[2] + backwardMovement[2]
            ];

            inv = translate4(inv, ...combinedMovement);

            // Apply rotations
            inv = rotate4(inv, yaw + rightTurnAngle, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);
            let yaw_tmp = yaw + rightTurnAngle;
            let pitch_tmp = pitch;
            let movement_tmp = combinedMovement;
            storeCameraPose(viewMatrix, yaw_tmp, pitch_tmp, movement_tmp);
            
            socket.emit('gen', viewMatrix);  // Send generate signal to the server
        }
        if (e.code === "KeyF") {
            active_camera.fx += 10; // Adjust 10 to your desired increment value
            active_camera.fy += 10; // Adjust 10 to your desired increment value
            // use_intrinsics(active_camera);
            update_displayed_info(active_camera);
        }

        if (e.code === "KeyG") {
            active_camera.fx -= 10; // Adjust 10 to your desired decrement value
            active_camera.fy -= 10; // Adjust 10 to your desired decrement value
            // use_intrinsics(active_camera);
            update_displayed_info(active_camera);
        }
        
        // Undo
        if (e.code === "KeyZ") {
            socket.emit('undo');
        }

        if (e.code === "KeyX") {
            socket.emit('save');
        }
        
        if (e.code === "KeyE") {
            socket.emit('fill_hole');
        }

        if (e.code === "KeyC") {
            let inv = invert4(defaultViewMatrix);
            pitch = 0;
            inv = translate4(inv, ...movement);

            // Apply rotations
            inv = rotate4(inv, yaw, 0, 1, 0); // Yaw around the Y-axis
            inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

            // Compute the view matrix
            viewMatrix = invert4(inv);

            socket.emit('delete', viewMatrix);
        }

        if (!activeKeys.includes(e.code)) activeKeys.push(e.code);
        if (/\d/.test(e.key)) {
            currentCameraIndex = parseInt(e.key)
            active_camera = JSON.parse(JSON.stringify(cameras[currentCameraIndex]));
            use_camera(active_camera);
            update_displayed_info(active_camera);
        }
    });

    window.addEventListener("keyup", (e) => {
        if (document.activeElement != document.body) return;
        activeKeys = activeKeys.filter((k) => k !== e.code);
    });

    window.addEventListener("blur", () => {
        activeKeys = [];
    });

    let lastFrame = 0;
    let avgFps = 0;

    const frame = (now) => {
        let inv = invert4(defaultViewMatrix);
        speed_factor = 0.2;
        // speed_factor = 0.01;
        
        if (activeKeys.includes("KeyA")) yaw -= 0.02 * speed_factor;
        if (activeKeys.includes("KeyD")) yaw += 0.02 * speed_factor;
        if (activeKeys.includes("KeyW")) pitch += 0.005 * speed_factor;
        if (activeKeys.includes("KeyS")) pitch -= 0.005 * speed_factor;

        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        // Compute movement vector increment based on yaw
        let dx = 0, dz = 0, dy = 0;
        if (activeKeys.includes("ArrowUp")) dz += 0.02 * speed_factor;
        if (activeKeys.includes("ArrowDown")) dz -= 0.02 * speed_factor;
        if (activeKeys.includes("ArrowLeft")) dx -= 0.02 * speed_factor;
        if (activeKeys.includes("ArrowRight")) dx += 0.02 * speed_factor;
        if (activeKeys.includes("KeyN")) dy -= 0.02 * speed_factor;
        if (activeKeys.includes("KeyM")) dy += 0.02 * speed_factor;

        // Convert dx and dz into world coordinates based on yaw
        let forward = [Math.sin(yaw) * dz, 0, Math.cos(yaw) * dz];
        let right = [Math.sin(yaw + Math.PI / 2) * dx, 0, Math.cos(yaw + Math.PI / 2) * dx];

        // Update movement vector
        movement[0] += forward[0] + right[0];
        movement[1] += forward[1] + right[1] + dy; // This should generally remain 0 in a FPS
        movement[2] += forward[2] + right[2];

        // Apply translation based on movement vector
        inv = translate4(inv, ...movement);

        // Apply rotations
        inv = rotate4(inv, yaw, 0, 1, 0); // Yaw around the Y-axis
        inv = rotate4(inv, pitch, 1, 0, 0); // Pitch around the X-axis

        // Compute the view matrix
        viewMatrix = invert4(inv);

        const currentFps = 1000 / (now - lastFrame) || 0;
        avgFps = avgFps * 0.9 + currentFps * 0.1;

        fps.innerText = Math.round(avgFps) + " fps";
        lastFrame = now;
        requestAnimationFrame(frame);
    };

    frame();

    // Send camera pose updates to the server every 50ms (20 FPS)
    setInterval(sendCameraPose, 1000 / 60);
}

main().catch((err) => {
    document.getElementById("message").innerText = err.toString();
});