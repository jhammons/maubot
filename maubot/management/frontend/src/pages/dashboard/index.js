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
import React, { Component } from "react"
import { Route, Switch, Link, withRouter } from "react-router-dom"
import api from "../../api"
import { ReactComponent as Plus } from "../../res/plus.svg"
import Instance from "./Instance"
import Client from "./Client"
import Plugin from "./Plugin"
import Home from "./Home"
import Log from "./Log"
import Modal from "./Modal"

class Dashboard extends Component {
    constructor(props) {
        super(props)
        this.state = {
            instances: {},
            clients: {},
            plugins: {},
            sidebarOpen: false,
            modalOpen: false,
            logFocus: null,
            logLines: [],
        }
        this.logModal = {
            open: () => undefined,
            isOpen: () => false,
        }
        window.maubot = this
    }

    componentDidUpdate(prevProps) {
        if (this.props.location !== prevProps.location) {
            this.setState({ sidebarOpen: false })
        }
    }

    async componentWillMount() {
        const [instanceList, clientList, pluginList] = await Promise.all([
            api.getInstances(), api.getClients(), api.getPlugins(),
            api.updateDebugOpenFileEnabled()])
        const instances = {}
        for (const instance of instanceList) {
            instances[instance.id] = instance
        }
        const clients = {}
        for (const client of clientList) {
            clients[client.id] = client
        }
        const plugins = {}
        for (const plugin of pluginList) {
            plugins[plugin.id] = plugin
        }
        this.setState({ instances, clients, plugins })

        const logs = await api.openLogSocket()

        const processEntry = (entry) => {
            entry.time = new Date(entry.time)
            if (entry.name.startsWith("maubot.")) {
                entry.name = entry.name.substr("maubot.".length)
            }
            if (entry.name.startsWith("client.")) {
                entry.name = entry.name.substr("client.".length)
                entry.nameLink = `/client/${entry.name}`
            } else if (entry.name.startsWith("instance.")) {
                entry.nameLink = `/instance/${entry.name.substr("instance.".length)}`
            }
        }

        logs.onHistory = history => {
            for (const data of history) {
                processEntry(data)
            }
            this.setState({
                logLines: history,
            })
        }
        logs.onLog = data => {
            processEntry(data)
            this.setState({
                logLines: this.state.logLines.concat(data),
            })
        }
    }

    renderList(field, type) {
        return this.state[field] && Object.values(this.state[field]).map(entry =>
            React.createElement(type, { key: entry.id, entry }))
    }

    delete(stateField, id) {
        const data = Object.assign({}, this.state[stateField])
        delete data[id]
        this.setState({ [stateField]: data })
    }

    add(stateField, entry, oldID = undefined) {
        const data = Object.assign({}, this.state[stateField])
        if (oldID && oldID !== entry.id) {
            delete data[oldID]
        }
        data[entry.id] = entry
        this.setState({ [stateField]: data })
    }

    renderView(field, type, id) {
        const entry = this.state[field][id]
        if (!entry) {
            return this.renderNotFound(field.slice(0, -1))
        }
        return React.createElement(type, {
            entry,
            onDelete: () => this.delete(field, id),
            onChange: newEntry => this.add(field, newEntry, id),
            openLog: this.openLog,
            ctx: this.state,
        })
    }

    openLog = filter => {
        this.setState({
            logFocus: typeof filter === "string" ? filter : null,
        })
        this.logModal.open()
    }

    renderNotFound = (thing = "path") => (
        <div className="not-found">
            Oops! I'm afraid that {thing} couldn't be found.
        </div>
    )

    renderMain() {
        return <div className={`dashboard ${this.state.sidebarOpen ? "sidebar-open" : ""}`}>
            <Link to="/" className="title">
                <img src="favicon.png" alt=""/>
                Maubot Manager
            </Link>
            <div className="user">
                <span>{localStorage.username}</span>
            </div>

            <nav className="sidebar">
                <div className="buttons">
                    <button className="open-log" onClick={this.openLog}>
                        <span>View logs</span>
                    </button>
                </div>
                <div className="instances list">
                    <div className="title">
                        <h2>Instances</h2>
                        <Link to="/new/instance"><Plus/></Link>
                    </div>
                    {this.renderList("instances", Instance.ListEntry)}
                </div>
                <div className="clients list">
                    <div className="title">
                        <h2>Clients</h2>
                        <Link to="/new/client"><Plus/></Link>
                    </div>
                    {this.renderList("clients", Client.ListEntry)}
                </div>
                <div className="plugins list">
                    <div className="title">
                        <h2>Plugins</h2>
                        <Link to="/new/plugin"><Plus/></Link>
                    </div>
                    {this.renderList("plugins", Plugin.ListEntry)}
                </div>
            </nav>

            <div className="topbar">
                <div className={`hamburger ${this.state.sidebarOpen ? "active" : ""}`}
                     onClick={evt => this.setState({ sidebarOpen: !this.state.sidebarOpen })}>
                    <span/><span/><span/>
                </div>
            </div>

            <main className="view">
                <Switch>
                    <Route path="/" exact render={() => <Home openLog={this.openLog}/>}/>
                    <Route path="/new/instance" render={() =>
                        <Instance onChange={newEntry => this.add("instances", newEntry)}
                                  entry={{}} ctx={this.state}/>}/>
                    <Route path="/new/client" render={() =>
                        <Client entry={{}} onChange={newEntry =>
                            this.add("clients", newEntry)}/>}/>
                    <Route path="/new/plugin" render={() =>
                        <Plugin entry={{}} onChange={newEntry =>
                            this.add("plugins", newEntry)}/>}/>
                    <Route path="/instance/:id" render={({ match }) =>
                        this.renderView("instances", Instance, match.params.id)}/>
                    <Route path="/client/:id" render={({ match }) =>
                        this.renderView("clients", Client, match.params.id)}/>
                    <Route path="/plugin/:id" render={({ match }) =>
                        this.renderView("plugins", Plugin, match.params.id)}/>
                    <Route render={() => this.renderNotFound()}/>
                </Switch>
            </main>
        </div>
    }

    renderModal() {
        return <Modal ref={ref => this.logModal = ref}>
            <Log lines={this.state.logLines} focus={this.state.logFocus}/>
        </Modal>
    }

    render() {
        return <>
            {this.renderMain()}
            {this.renderModal()}
        </>
    }
}

export default withRouter(Dashboard)
