// maubot - A plugin-based Matrix bot system.
// Copyright (C) 2018 Tulir Asokan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

export const BASE_PATH = "/_matrix/maubot/v1"

function getHeaders(contentType = "application/json") {
    return {
        "Content-Type": contentType,
        "Authorization": `Bearer ${localStorage.accessToken}`,
    }
}

async function defaultDelete(type, id) {
    const resp = await fetch(`${BASE_PATH}/${type}/${id}`, {
        headers: getHeaders(),
        method: "DELETE",
    })
    if (resp.status === 204) {
        return {
            "success": true,
        }
    }
    return await resp.json()
}

async function defaultPut(type, entry, id = undefined) {
    const resp = await fetch(`${BASE_PATH}/${type}/${id || entry.id}`, {
        headers: getHeaders(),
        body: JSON.stringify(entry),
        method: "PUT",
    })
    return await resp.json()
}

async function defaultGet(path) {
    const resp = await fetch(`${BASE_PATH}${path}`, { headers: getHeaders() })
    return await resp.json()
}

export async function login(username, password) {
    const resp = await fetch(`${BASE_PATH}/auth/login`, {
        method: "POST",
        body: JSON.stringify({
            username,
            password,
        }),
    })
    return await resp.json()
}

export async function ping() {
    const response = await fetch(`${BASE_PATH}/auth/ping`, {
        method: "POST",
        headers: getHeaders(),
    })
    const json = await response.json()
    if (json.username) {
        return json.username
    } else if (json.errcode === "auth_token_missing" || json.errcode === "auth_token_invalid") {
        return null
    }
    throw json
}

export async function openLogSocket() {
    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${window.location.host}${BASE_PATH}/logs`
    const wrapper = {
        socket: null,
        connected: false,
        authenticated: false,
        onLog: data => undefined,
        onHistory: history => undefined,
        fails: -1,
    }
    const openHandler = () => {
        wrapper.socket.send(localStorage.accessToken)
        wrapper.connected = true
    }
    const messageHandler = evt => {
        // TODO use logs
        const data = JSON.parse(evt.data)
        if (data.auth_success !== undefined) {
            if (data.auth_success) {
                console.info("Websocket connection authentication successful")
                wrapper.authenticated = true
                wrapper.fails = -1
            } else {
                console.info("Websocket connection authentication failed")
            }
        } else if (data.history) {
            wrapper.onHistory(data.history)
        } else {
            wrapper.onLog(data)
        }
    }
    const closeHandler = evt => {
        if (evt) {
            if (evt.code === 4000) {
                console.error("Websocket connection failed: access token invalid or not provided")
            } else if (evt.code === 1012) {
                console.info("Websocket connection closed: server is restarting")
            }
        }
        wrapper.connected = false
        wrapper.socket = null
        wrapper.fails++
        const SECOND = 1000
        setTimeout(() => {
            wrapper.socket = new WebSocket(url)
            wrapper.socket.onopen = openHandler
            wrapper.socket.onmessage = messageHandler
            wrapper.socket.onclose = closeHandler
        }, Math.min(wrapper.fails * 5 * SECOND, 30 * SECOND))
    }

    closeHandler()

    return wrapper
}

let _debugOpenFileEnabled = undefined
export const debugOpenFileEnabled = () => _debugOpenFileEnabled
export const updateDebugOpenFileEnabled = async () => {
    const resp = await defaultGet("/debug/open")
    _debugOpenFileEnabled = resp["enabled"] || false
}

export async function debugOpenFile(path, line) {
    const resp = await fetch(`${BASE_PATH}/debug/open`, {
        headers: getHeaders(),
        body: JSON.stringify({ path, line }),
        method: "POST",
    })
    return await resp.json()
}

export const getInstances = () => defaultGet("/instances")
export const getInstance = id => defaultGet(`/instance/${id}`)
export const putInstance = (instance, id) => defaultPut("instance", instance, id)
export const deleteInstance = id => defaultDelete("instance", id)

export const getPlugins = () => defaultGet("/plugins")
export const getPlugin = id => defaultGet(`/plugin/${id}`)
export const deletePlugin = id => defaultDelete("plugin", id)

export async function uploadPlugin(data, id) {
    let resp
    if (id) {
        resp = await fetch(`${BASE_PATH}/plugin/${id}`, {
            headers: getHeaders("application/zip"),
            body: data,
            method: "PUT",
        })
    } else {
        resp = await fetch(`${BASE_PATH}/plugins/upload`, {
            headers: getHeaders("application/zip"),
            body: data,
            method: "POST",
        })
    }
    return await resp.json()
}

export const getClients = () => defaultGet("/clients")
export const getClient = id => defaultGet(`/clients/${id}`)

export async function uploadAvatar(id, data, mime) {
    const resp = await fetch(`${BASE_PATH}/proxy/${id}/_matrix/media/r0/upload`, {
        headers: getHeaders(mime),
        body: data,
        method: "POST",
    })
    return await resp.json()
}

export function getAvatarURL({ id, avatar_url }) {
    avatar_url = avatar_url || ""
    if (avatar_url.startsWith("mxc://")) {
        avatar_url = avatar_url.substr("mxc://".length)
    }
    return `${BASE_PATH}/proxy/${id}/_matrix/media/r0/download/${avatar_url}?access_token=${
        localStorage.accessToken}`
}

export const putClient = client => defaultPut("client", client)
export const deleteClient = id => defaultDelete("client", id)

export default {
    BASE_PATH,
    login, ping, openLogSocket, debugOpenFile, debugOpenFileEnabled, updateDebugOpenFileEnabled,
    getInstances, getInstance, putInstance, deleteInstance,
    getPlugins, getPlugin, uploadPlugin, deletePlugin,
    getClients, getClient, uploadAvatar, getAvatarURL, putClient, deleteClient,
}
