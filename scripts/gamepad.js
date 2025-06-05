const defaultButtonMap = {
    "up": 12,
    "down": 13,
    "left": 14,
    "right": 15,
    "l1": 4,
    "l2": 6,
    "r1": 5,
    "r2": 7,
    "a": 0,
    "b": 1,
    "x": 2,
    "y": 3,
};
        
const gamepad = ((buttonMap = defaultButtonMap) => {
    let gamepads = [];
    const handleGamepadConnected = (event) => {
        gamepads[event.gamepad.index] = event.gamepad;
    };

    const handleGamepadDisconnected = (event) => {
        delete gamepads[event.gamepad.index];
    };

    const control = {
        "up": false,
        "down": false,
        "left": false,
        "right": false,
        "l1": false,
        "l2": false,
        "r1": false,
        "r2": false,
        "a": false,
        "b": false,
        "x": false,
        "y": false,
        "axis1": { magnitude: 0, direction: 0 },
        "axis2": { magnitude: 0, direction: 0 },
    };

    const initialize = () => {
        window.addEventListener("gamepadconnected", handleGamepadConnected);
        window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

        const initialGamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (let i = 0; i < initialGamepads.length; i++) {
            if (initialGamepads[i]) {
                gamepads[i] = initialGamepads[i];
                console.log("Initial gamepad found:", initialGamepads[i]);
            }
        }
    };

    const update = () => {
        const updatedGamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (let i = 0; i < updatedGamepads.length; i++) {
            if (updatedGamepads[i]) {
                gamepads[i] = updatedGamepads[i];
                updateControlState(i, updatedGamepads[i]);
            }
        }
    };

    const updateControlState = (gamepadIndex, gamepad) => {
        if (!gamepad) {
            return;
        }

        for (const buttonName in buttonMap) {
            const buttonIndex = buttonMap[buttonName];
            if (gamepad.buttons && gamepad.buttons[buttonIndex]) {
                control[buttonName] = gamepad.buttons[buttonIndex].pressed
                    ? gamepad.buttons[buttonIndex].value
                    : false;
            } else {
                control[buttonName] = false;
            }
        }

        if (gamepad.axes && gamepad.axes.length >= 2) {
            control.axis1.magnitude = Math.sqrt(gamepad.axes[0] ** 2 + gamepad.axes[1] ** 2);
            control.axis1.direction = Math.atan2(gamepad.axes[1], gamepad.axes[0]);
        }
        if (gamepad.axes && gamepad.axes.length >= 4) {
            control.axis2.magnitude = Math.sqrt(gamepad.axes[2] ** 2 + gamepad.axes[3] ** 2);
            control.axis2.direction = Math.atan2(gamepad.axes[3], gamepad.axes[2]);
        }
    };

    const getGamepads = () => {
        return Object.values(gamepads).filter(gp => gp !== undefined);
    };

    const getGamepad = (index) => {
        return gamepads[index];
    };

    const getButton = (gamepadIndex, buttonIndex) => {
        const gamepad = gamepads[gamepadIndex];
        if (gamepad && gamepad.buttons && gamepad.buttons[buttonIndex]) {
            const button = gamepad.buttons[buttonIndex];
            return button.pressed ? button.value : false;
        }
        return undefined;
    };

    const getButtons = (gamepadIndex) => {
        const gamepad = gamepads[gamepadIndex];
        if (gamepad && gamepad.buttons) {
            return gamepad.buttons.map(button => button.pressed ? button.value : false);
        }
        return undefined;
    };

    const getAxis = (gamepadIndex, axisIndex) => {
        const gamepad = gamepads[gamepadIndex];
        if (gamepad && gamepad.axes && gamepad.axes[axisIndex]) {
            return gamepad.axes[axisIndex];
        }
        return undefined;
    };

    const getControlState = () => {
        return { ...control };
    };

    return {
        initialize: initialize,
        update: update,
        getGamepads: getGamepads,
        getGamepad: getGamepad,
        getButton: getButton,
        getButtons: getButtons,
        getAxis: getAxis,
        getControlState: getControlState,
    };
})();
