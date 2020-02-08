import { TypeDescription, TypeTable } from "./ast";

const simpleStringTypes = ["string", "cep", "email", "phone", "safehtml", "xml"];
const simpleTypes = ["json", "bool", "hex", "uuid", "base64", "url", "int", "uint", "float", "money", "void", "latlng", ...simpleStringTypes];

function bufferToBase64(buffer: Buffer) {
    return buffer.toString("base64");
}
function base64ToBuffer(str: string) {
    return Buffer.from(str, "base64");
}
function simpleEncodeDecode(path: string, type: string, value: any) {
    if (typeof value === "bigint") {
        value = Number(value);
    }
    if (type === "json") {
        if (value === null || value === undefined) {
            return null;
        } else {
            return JSON.parse(JSON.stringify(value));
        }
    } else if (type === "bool") {
        if (typeof value !== "boolean") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (simpleStringTypes.indexOf(type) >= 0) {
        if (typeof value !== "string") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "hex") {
        if (typeof value !== "string" || !value.match(/^(?:[A-Fa-f0-9]{2})*$/)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value.toLowerCase();
    } else if (type === "uuid") {
        if (typeof value !== "string" || !value.match(/^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value.toLowerCase();
    } else if (type === "base64") {
        if (typeof value !== "string" || bufferToBase64(base64ToBuffer(value)) !== value) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "int") {
        if (typeof value !== "number" || (value | 0) !== value) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "uint") {
        if (typeof value !== "number" || (value | 0) !== value || value < 0) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "float") {
        if (typeof value !== "number") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "money") {
        if (typeof value !== "number" || !Number.isInteger(value)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "url") {
        let isValid = typeof value === "string";
        let url: URL;
        if (isValid) {
            try {
                url = new URL(value)
            } catch (e) {
                isValid = false;
            }
        }
        if (!isValid) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return url!.toString();
    } else if (type === "void") {
        return null;
    } else if (type === "latlng") {
        if (typeof value !== "object" || typeof value.lat !== "number" || typeof value.lng !== "number") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else {
        throw new Error(`Unknown type '${type}' at '${path}'`);
    }
}

export function encode(typeTable: TypeTable, path: string, type: TypeDescription, value: any): any {
    if (typeof type === "string" && !type.endsWith("?") && type !== "void" && (value === null || value === undefined)) {
        throw new Error(`Invalid type at '${path}', cannot be null`);
    } else if (Array.isArray(type)) {
        if (type.indexOf(value) < 0) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (typeof type === "object") {
        if (typeof value !== "object" || value === undefined) {
            throw new Error(`Invalid type at '${path}', expected object, got ${JSON.stringify(value)}`);
        }
        const obj: any = {};
        for (const key in type) {
            obj[key] = encode(typeTable, `${path}.${key}`, type[key], value[key]);
        }
        return obj;
    } else if (type.endsWith("?")) {
        if (value === null || value === undefined)
            return null;
        else
            return encode(typeTable, path, type.slice(0, type.length - 1), value);
    } else if (type.endsWith("[]")) {
        if (!Array.isArray(value)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value.map((entry, index) => encode(typeTable, `${path}[${index}]`, type.slice(0, type.length - 2), entry));
    } else if (simpleTypes.indexOf(type) >= 0) {
        return simpleEncodeDecode(path, type, value);
    } else if (type === "bytes") {
        if (!(value instanceof Buffer)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return bufferToBase64(value);
    } else if (type === "cpf") {
        if (typeof value !== "string") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "cnpj") {
        if (typeof value !== "string") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "date") {
        if (!(value instanceof Date)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value.toISOString().split("T")[0];
    } else if (type === "datetime") {
        if (!(value instanceof Date)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value.toISOString().replace("Z", "");
    } else {
        const resolved = typeTable[type];
        if (resolved) {
            return encode(typeTable, path, resolved, value);
        } else {
            throw new Error(`Unknown type '${type}' at '${path}'`);
        }
    }
}

export function decode(typeTable: TypeTable, path: string, type: TypeDescription, value: any): any {
    if (typeof type === "string" && !type.endsWith("?") && type !== "void" && (value === null || value === undefined)) {
        throw new Error(`Invalid type at '${path}', cannot be null`);
    } else if (Array.isArray(type)) {
        if (type.indexOf(value) < 0) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (typeof type === "object") {
        if (typeof value !== "object" || value === undefined) {
            throw new Error(`Invalid type at '${path}', expected object, got ${JSON.stringify(value)}`);
        }
        const obj: any = {};
        for (const key in type) {
            obj[key] = decode(typeTable, `${path}.${key}`, type[key], value[key]);
        }
        return obj;
    } else if (type.endsWith("?")) {
        if (value === null || value === undefined)
            return null;
        else
            return decode(typeTable, path, type.slice(0, type.length - 1), value);
    } else if (type.endsWith("[]")) {
        if (!Array.isArray(value)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value.map((entry, index) => decode(typeTable, `${path}[${index}]`, type.slice(0, type.length - 2), entry));
    } else if (simpleTypes.indexOf(type) >= 0) {
        return simpleEncodeDecode(path, type, value);
    } else if (type === "bytes") {
        if (typeof value !== "string") {
            throw new Error(`Invalid type at '${path}', expected ${type} (base64), got ${JSON.stringify(value)}`);
        }
        const buffer = base64ToBuffer(value);
        if (bufferToBase64(buffer) !== value) {
            throw new Error(`Invalid type at '${path}', expected ${type} (base64), got ${JSON.stringify(value)}`);
        }
        return buffer;
    } else if (type === "cpf") {
        if (typeof value !== "string") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "cnpj") {
        if (typeof value !== "string") {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return value;
    } else if (type === "date") {
        if (typeof value !== "string" || !value.match(/^[0-9]{4}-[01][0-9]-[0123][0-9]$/)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return new Date(parseInt(value.split("-")[0], 10), parseInt(value.split("-")[1], 10) - 1, parseInt(value.split("-")[2], 10));
    } else if (type === "datetime") {
        if (typeof value !== "string" || !value.match(/^[0-9]{4}-[01][0-9]-[0123][0-9]T[012][0-9]:[0123456][0-9]:[0123456][0-9](\.[0-9]{1,6})?Z?$/)) {
            throw new Error(`Invalid type at '${path}', expected ${type}, got ${JSON.stringify(value)}`);
        }
        return new Date(value + "Z");
    } else {
        const resolved = typeTable[type];
        if (resolved) {
            return decode(typeTable, path, resolved, value);
        } else {
            throw new Error(`Unknown type '${type}' at '${path}'`);
        }
    }
}