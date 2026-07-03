// src/api/AuthService.js
import axios from "axios";

export default class AuthService {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }

    async register() {
        const url = "/notes/api/user/register/";
        const params = {
            username: this.username,
            password: this.password,
        };
        const headers = { "Content-Type": "application/json" };
        const response = await axios.post(url, params, { headers });
        return response.data;
    }

    async login() {
        const url = "/notes/api/token/";
        const params = {
            username: this.username,
            password: this.password,
        };
        const headers = { "Content-Type": "application/json" };
        const response = await axios.post(url, params, { headers });
        return response.data;
    }
}

// ✅ Helper functions for easier use inside components
export async function registerUser(username, password) {
    const auth = new AuthService(username, password);
    return await auth.register();
}

export async function loginUser(username, password) {
    const auth = new AuthService(username, password);
    return await auth.login();
}
