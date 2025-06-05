function getRandomColorHex() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

function adjustBrightness(hexColor, brightnessFactor) {
    // Validate inputs
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(hexColor)) {
        throw new Error("Invalid hexadecimal color code.");
    }
    if (typeof brightnessFactor !== 'number' || brightnessFactor < -1 || brightnessFactor > 1) {
        throw new Error("Brightness factor must be a number between -1 and 1.");
    }
    
    // Remove the '#' if present and convert to 6-digit hex
    let hex = hexColor.slice(hexColor.startsWith('#') ? 1 : 0);
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convert hex to RGB components
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    // Adjust brightness
    const newR = Math.min(255, Math.max(0, r + Math.round(r * brightnessFactor)));
    const newG = Math.min(255, Math.max(0, g + Math.round(g * brightnessFactor)));
    const newB = Math.min(255, Math.max(0, b + Math.round(b * brightnessFactor)));
    
    // Convert back to hexadecimal
    const toHex = (c) => {
        const hexValue = c.toString(16);
        return hexValue.length === 1 ? "0" + hexValue : hexValue;
    };
    
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

function getRelativeBrightness(hexColor) {
    // Validate input
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(hexColor)) {
        throw new Error("Invalid hexadecimal color code.");
    }
    
    // Remove '#' and normalize to 6-digit hex
    let hex = hexColor.slice(hexColor.startsWith('#') ? 1 : 0);
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convert hex to RGB components
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    const luminance = r + g + b;
    
    // Calculate the number of primary colors used
    const primaryColors = (r > 0) + (g > 0) + (b > 0);
    
    // Normalize luminance to the range of 0 to 1
    // Return the brightness indicator in the range of 0 to 1
    return (luminance) / (255 * primaryColors);
}


function isValidHexColor(hexColor) {
    if (!hexColor || typeof hexColor !== "string") {
        return false;
    }
    if (!hexColor.startsWith('#')) {
        return false;
    }
    const hexValue = hexColor.slice(1);
    if ([3, 4].includes(hexValue.length) && hexValue.length !== 6) {
        return false;
    }
    if (hexColor.length !== 7 && hexColor.length !== 9) {
        return false;
    }
    return /^[0-9a-fA-F]+$/.test(hexValue);
}

