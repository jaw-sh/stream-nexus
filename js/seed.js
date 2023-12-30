// ==UserScript==
// @name S.N.E.E.D.
// @version 1.2.0
// @description Stream Nexus userscript.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @match https://kick.com/*
// @match https://kick.com/*/chatroom
// @match https://odysee.com/@*/*
// @match https://odysee.com/$/popout/*
// @match https://rumble.com/v*.html
// @match https://rumble.com/chat/popup/*
// @match https://www.twitch.tv/*
// @match https://vk.com/video/lives?z=*
// @match https://twitter.com/i/broadcasts/*
// @match https://x.com/i/broadcasts/*
// @match https://www.youtube.com/live_chat?*
// @connect *
// @grant unsafeWindow
// @run-at document-start
// ==/UserScript==
(async function () {
    'use strict';

    const SOCKET_URL = "ws://127.0.0.2:1350/chat.ws";
    const DEBUG = true;

    //
    // Chat Message
    //
    class ChatMessage {
        constructor(id, platform, channel) {
            this.id = id;
            this.platform = platform;
            this.channel = channel;
            this.sent_at = Date.now(); // System timestamp for display ordering.
            this.received_at = Date.now(); // Local timestamp for management.

            this.message = "";

            this.username = "DUMMY_USER";
            this.avatar = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="; // Transparent pixel.

            this.amount = 0;
            this.currency = "ZWL";

            this.is_verified = false;
            this.is_sub = false;
            this.is_mod = false;
            this.is_owner = false;
            this.is_staff = false;
        }

    }

    //
    // Seed
    //
    /// Base class for all platforms.
    class Seed {
        /// Channel name used as a token and in messages.
        channel = null;
        /// UUID used for generating v5 UUIDs consistently to each platform.
        namespace = null;
        /// Platform name used as a token and in messages.
        platform = null;

        /// Messages waiting to be sent to the Rust backend.
        chatMessageQueue = [];
        /// Current connection to the Rust backend.
        chatSocket = null;

        constructor(namespace, platform, channel) {
            this.namespace = namespace;
            this.platform = platform;
            this.channel = channel;

            this.log("Initializing.");
            this.eventSourcePatch();
            this.fetchPatch();
            this.webSocketPatch();
            this.xhrPatch();

            this.fetchDependencies();

            this.log("Setting up.");
            this.createChatSocket();
        }

        debug(message, ...args) {
            if (DEBUG) {
                this.log(message, ...args);
            }
        }

        log(message, ...args) {
            if (args.length > 0) {
                console.log(`[SNEED::${this.platform}] ${message}`, ...args);
            }
            else {
                console.log(`[SNEED::${this.platform}] ${message}`);
            }
        }

        async fetchDependencies() {
            window.UUID = await import('https://jspm.dev/uuid');
        }

        onDocumentReady() {
            this.log("Document ready.");
        }

        //
        // Chat Socket
        //
        // Creates a WebSocket to the Rust chat server.
        createChatSocket() {
            if (this.chatSocket !== null && this.chatSocket.readyState === WebSocket.OPEN) {
                this.log("Chat socket already exists and is open.");
            }
            else {
                this.log("Creating chat socket.");
                const ws = new WebSocket.oldWebSocket(SOCKET_URL);
                ws.addEventListener("open", (event) => this.onChatSocketOpen(ws, event));
                ws.addEventListener("message", (event) => this.onChatSocketMessage(ws, event));
                ws.addEventListener("close", (event) => this.onChatSocketClose(ws, event));
                ws.addEventListener("error", (event) => this.onChatSocketError(ws, event));

                ws.sneed_socket = true;
                this.chatSocket = ws;
            }

            return this.chatSocket;
        }

        // Called when the chat socket is opened.
        onChatSocketOpen(ws, event) {
            this.debug("Chat socket opened.");
            this.sendChatMessages(this.chatMessageQueue);
            this.chatMessageQueue = [];
        }

        // Called when the chat socket receives a message.
        onChatSocketMessage(ws, event) {
            this.debug("Chat socket received data.", event);
        }

        // Called when the chat socket is closed.
        onChatSocketClose(ws, event) {
            this.debug("Chat socket closed.", event);
            setTimeout(() => this.createChatSocket(), 3000);
        }

        // Called when the chat socket errors.
        onChatSocketError(ws, event) {
            this.debug("Chat socket errored.", event);
            ws.close();
            setTimeout(() => this.createChatSocket(), 3000);
        }

        /// Sends messages to the Rust backend, or adds them to the queue.
        sendChatMessages(messages) {
            // Check if the chat socket is open.
            if (this.chatSocket.readyState === WebSocket.OPEN) {
                // Send message queue to Rust backend.
                this.chatSocket.send(JSON.stringify({
                    platform: this.platform,
                    channel: this.channel,
                    messages: messages,
                }));
            }
            else {
                // Add messages to queue.
                this.chatMessageQueue.push(...messages);
            }
        }

        //
        // EventSource
        //
        // Patches the EventSource object to log all messages.
        eventSourcePatch() {
            const self = this;
            const oldEventSource = unsafeWindow.EventSource;
            const newEventSource = function (url, config) {
                const es = new oldEventSource(url, config);

                es.addEventListener('message', function (event) {
                    self.onEventSourceMessage(es, event);
                });

                return es;
            };
            newEventSource.sneed_patched = true;
            newEventSource.oldEventSource = oldEventSource;
            unsafeWindow.EventSource = Object.assign(newEventSource, oldEventSource);
            return unsafeWindow.EventSource;
        }

        // Called when an EventSource receives a message.
        onEventSourceMessage(es, event) {
            this.debug("EventSource received data.", event);
        }

        //
        // Fetch
        //
        fetchPatch() {
            const self = this;
            const oldFetch = unsafeWindow.fetch;
            const newFetch = function (...args) {
                let [resource, config] = args;
                const response = oldFetch(resource, config);
                response.then((data) => {
                    // Clone and return original response.
                    const newData = data.clone();
                    self.onFetchResponse(newData);
                    return data;
                });
                return response;
            };
            newFetch.sneed_patched = true;
            newFetch.oldFetch = oldFetch;
            unsafeWindow.fetch = Object.assign(newFetch, oldFetch);
            return unsafeWindow.fetch;
        }

        // Called when a fetch's promise is fulfilled.
        onFetchResponse(response) {
            this.debug("Fetch received data.", response);
        }

        //
        // WebSocket
        //
        // Patches the WebSocket object to log all inbound and outbound messages.
        webSocketPatch() {
            const self = this;
            const oldWebSocket = unsafeWindow.WebSocket;
            const newWebSocket = function (url, protocols) {
                const ws = new oldWebSocket(url, protocols);
                const oldWsSend = ws.send;
                ws.send = function (data) {
                    self.onWebSocketSend(ws, data);
                    return oldWsSend.apply(ws, arguments);
                };
                ws.addEventListener('message', (event) => self.onWebSocketMessage(ws, event));
                ws.send.sneed_patched = true;
                return ws;
            };
            newWebSocket.sneed_patched = true;
            newWebSocket.oldWebSocket = oldWebSocket;
            unsafeWindow.WebSocket = Object.assign(newWebSocket, oldWebSocket);
            return unsafeWindow.WebSocket;
        }

        // Called when a websocket receives a message.
        onWebSocketMessage(ws, event) {
            this.debug("WebSocket received data.", event);
        }

        // Called when a websocket sends a message.
        onWebSocketSend(ws, data) {
            this.debug("WebSocket sent data.", data);
        }

        //
        // XHR
        //
        // Patches the XHR object to log all inbound and outbound messages.
        xhrPatch() {
            const self = this;

            // XMLHttpRequest.open
            const oldXhrOpen = unsafeWindow.XMLHttpRequest.prototype.open;
            const newXhrOpen = function (method, url, async, user, password) {
                self.onXhrOpen(this, method, url, async, user, password);
                return oldXhrOpen.apply(this, arguments);
            };
            newXhrOpen.sneed_patched = true;
            unsafeWindow.XMLHttpRequest.prototype.open = Object.assign(newXhrOpen, oldXhrOpen);

            // XMLHttpRequest.send
            const oldXhrSend = unsafeWindow.XMLHttpRequest.prototype.send;
            const newXhrSend = function (body) {
                self.onXhrSend(this, body);
                return oldXhrSend.apply(this, arguments);
            };
            newXhrSend.sneed_patched = true;
            unsafeWindow.XMLHttpRequest.prototype.send = Object.assign(newXhrSend, oldXhrSend);

            return unsafeWindow.XMLHttpRequest;
        }

        onXhrOpen(xhr, method, url, async, user, password) {
            this.debug("XHR opened.", method, url, async, user, password);
            xhr.addEventListener("readystatechange", (event) => this.onXhrReadyStateChange(xhr, event));
        }

        onXhrReadyStateChange(xhr, event) {
            this.debug("XHR ready state changed.", event);
        }

        onXhrSend(xhr, body) {
            this.debug("XHR sent data.", body);
        }
    }

    //
    // Kick
    //
    // ✔️ Capture new messages.
    // ✔️ Capture sent messages.
    // ✔️ Capture existing messages.
    // ✔️ Capture emotes.
    // ❌ Capture moderator actions.
    //
    class Kick extends Seed {
        channel_id = null;

        constructor() {
            const namespace = "6efe7271-da75-4c2f-93fc-ddf37d02b8a9";
            const platform = "Kick";
            const channel = window.location.href.split('/').filter(x => x)[2].toLowerCase();
            super(namespace, platform, channel);
            this.fetchChatHistory();
        }

        async fetchChatHistory() {
            this.channel_id = await fetch(`https://kick.com/api/v2/channels/${this.channel}`).then(response => response.json()).then(data => data.id);
            fetch(`https://kick.com/api/v2/channels/${this.channel_id}/messages`)
                .then(response => response.json())
                .then(json => {
                    this.log(json);
                    json.data.messages.reverse().forEach((messageJson) => {
                        const message = this.prepareChatMessage(messageJson);
                        this.sendChatMessages([message]);
                    });
                });
        }

        receiveChatMessage(json) {
            const message = this.prepareChatMessage(json);
            this.sendChatMessages([message]);
        }

        prepareChatMessage(json) {
            // WebSockets and XHR events in Kick only send one message at a time.
            const message = new ChatMessage(json.id, this.platform, this.channel);
            message.sent_at = Date.parse(json.created_at);
            message.username = json.sender.username;
            message.message = json.content;

            // Emotes are supplied as bbcode: [emote:37221:EZ]
            // Image file found at: https://files.kick.com/emotes/37221/fullsize
            // <img data-v-31c262c8="" data-emote-name="EZ" data-emote-id="37221" src="https://files.kick.com/emotes/37221/fullsize" alt="EZ" class="chat-emote">
            message.message.replace(/\[emote:(\d+):([^\]]+)\]/g, (match, id, name) => {
                message.message = message.message.replace(match, `<img class="emote" data-emote="${name}" src="https://files.kick.com/emotes/${id}/fullsize" alt="${name}" />`);
            });

            json.sender.identity.badges.forEach((badge) => {
                switch (badge.type) {
                    // Fluff badges.
                    case "vip":
                    case "og":
                    case "founder":
                        break;
                    case "verified":
                        message.is_verified = true;
                        break;
                    case "broadcaster":
                        message.is_owner = true;
                        break;
                    case "moderator":
                        message.is_mod = true;
                        break;
                    case "subscriber":
                    case "sub_gifter":
                        message.is_sub = true;
                        break;
                    default:
                        this.log(`Unknown badge type: ${badge.type}`);
                        break;
                }

            });

            return message;
        }

        onWebSocketMessage(ws, event) {
            const json = JSON.parse(event.data);
            if (json.event === undefined) {
                this.log("WebSocket received data with no event.", data);
            }

            switch (json.event) {
                case "App\\Events\\ChatMessageEvent":
                    //{"event":"App\\\\Events\\\\ChatMessageEvent","data":"{…}","channel":"chatrooms.35535.v2"}
                    this.receiveChatMessage(JSON.parse(json.data));
                    break;
                case "App\\Events\\UserBannedEvent":
                    // {"event":"App\\Events\\UserBannedEvent","data":"{\"id\":\"a3aadb10-22ae-4081-ba8f-46bb9a6c89ff\",\"user\":{\"id\":25556531,\"username\":\"JohnsonAndJohnson1\",\"slug\":\"johnsonandjohnson1\"},\"banned_by\":{\"id\":0,\"username\":\"covid1942\",\"slug\":\"covid1942\"}}","channel":"chatrooms.2507974.v2"}
                    break;
                case "pusher_internal:subscription_succeeded":
                    //{"event":"pusher_internal:subscription_succeeded","data":"{}","channel":"chatrooms.14693568.v2"}
                    //{"event":"pusher_internal:subscription_succeeded","data":"{}","channel":"private-userfeed.15671413"}
                    //{"event":"pusher_internal:subscription_succeeded","data":"{}","channel":"private-App.User.15671413"}
                    break;
                case "pusher:pong":
                    break;
                default:
                    this.log("WebSocket received data with unknown event.", json.event);
                    break;
            }
        }

        onWebSocketSend(ws, data) {
            const json = JSON.parse(data);
            if (json.event === undefined) {
                this.log("WebSocket sent data with no event.", data);
            }

            switch (json.event) {
                case "pusher:subscribe":
                    // This will pass auth tokens and event subscriptions.
                    // {"event":"pusher:subscribe","data":{"auth":"","channel":"chatrooms.14693568.v2"}}
                    // {"event":"pusher:subscribe","data":{"auth":"","channel":"channel.14899489"}
                    // {"event":"pusher:subscribe","data":{"auth":"xxx:xxx","channel":"private-userfeed.15671413"}}
                    // {"event":"pusher:subscribe","data":{"auth":"xxx:xxx","channel":"private-App.User.15671413"}}
                    break;
                case "pusher:ping":
                    break;
                default:
                    this.log("WebSocket sent data with unknown event.", data);
                    break;
            }
        }

        onXhrOpen(xhr, method, url, async, user, password) {
            if (url.startsWith("https://kick.com/api/v2/messages/send/")) {
                xhr.addEventListener("readystatechange", (event) => this.onXhrSendMessageReadyStateChange(xhr, event));
            }
        }

        /// After sending message, receive JSON for new message. 
        onXhrSendMessageReadyStateChange(xhr, event) {
            if (xhr.readyState !== XMLHttpRequest.DONE) {
                return;
            }

            const json = JSON.parse(xhr.responseText);
            if (json.status === undefined || json.data === undefined) {
                this.log("XHR sent message with no status or data.", json);
                return;
            }

            if (json.status.code === 200 && json.data.id !== undefined) {
                this.log("XHR sent message is ready.", json);
                this.receiveChatMessage(json.data);
            }
        }
    }


    //
    // Rumble
    //
    // ✔️ Capture new messages.
    // ✔️ Capture sent messages.
    // ✔️ Capture existing messages.
    // ✔️ Capture emotes.
    // ❌ Capture moderator actions.
    //
    class Rumble extends Seed {
        emotes = [];

        constructor() {
            const namespace = "5ceefcfb-4aa5-443a-bea6-1f8590231471";
            const platform = "Rumble";
            const channel = Rumble.getChannelId();
            super(namespace, platform, channel);
        }

        static getChannelId() {
            // Pop-out chat contains the channel ID in the URL.
            if (window.location.href.indexOf('/chat/popup/') >= 0) {
                return parseInt(window.location.href.split('/').filter(x => x)[4], 10);
            }
            // Otherwise, we need to find the channel ID in the DOM.
            else {
                // Yes, the only place in the DOM the channel ID exists is the upvote button.
                return parseInt(document.querySelector('.rumbles-vote-pill').dataset.id, 10);
            }
        }

        receiveChatPairs(messages, users) {
            const newMessages = this.prepareChatMessages(messages, users);
            this.sendChatMessages(newMessages);
        }

        prepareChatMessages(messages, users) {
            const newMessages = [];
            messages.forEach((messageData, index) => {
                const message = new ChatMessage(
                    UUID.v5(messageData.id, this.namespace),
                    this.platform,
                    this.channel
                );

                const user = users.find((user) => user.id === messageData.user_id);
                if (user === undefined) {
                    this.log("User not found:", messageData.user_id);
                    return;
                }

                message.sent_at = Date.parse(messageData.time);
                // replace :r+rumbleemoji: with <img> tags
                message.message = messageData.text.replace(/:(r\+.*?)\:/g, (match, id) => {
                    // {"request_id":"dT+js0Ay7a7e2ZeUi1GyzB7MoWCmLBp/e7jHzPKXXUs","type":"messages","data":{"messages":[{"id":"1346698824721596624","time":"2023-12-30T21:00:58+00:00","user_id":"88707682","text":":r+smh:","blocks":[{"type":"text.1","data":{"text":":r+smh:"}}]}],"users":[{"id":"88707682","username":"madattheinternet","link":"/user/madattheinternet","is_follower":false,"image.1":"https://ak2.rmbl.ws/z0/I/j/z/s/Ijzsf.asF-1gtbaa-rpmd6x.jpeg","color":"#f54fd1","badges":["premium","whale-gray"]}],"channels":[[]]}}	
                    if (this.emotes[id] !== undefined) {
                        return `<img class="emoji" data-emote="${id}" src="${this.emotes[id]}" alt="${id}" />`;
                    }
                    this.log(`no emote for ${id}`);
                    return match;
                });

                message.username = user.username;
                if (user['image.1'] !== undefined) {
                    message.avatar = user['image.1'];
                }

                if (user.badges !== undefined) {
                    user.badges.forEach((badge) => {
                        switch (badge) {
                            case "admin":
                                message.is_owner = true;
                                break;
                            case "moderator":
                                message.is_mod = true;
                                break;
                            case "whale-gray":
                            case "whale-blue":
                            case "whale-yellow":
                            case "locals":
                            case "locals_supporter":
                            case "recurring_subscription":
                                message.is_sub = true;
                                break;
                            case "premium":
                                break;
                            case "verified":
                                message.is_verified = true;
                                break;
                            default:
                                this.log(`Unknown badge type: ${badge.type}`);
                                break;
                        }
                    });
                }

                if (messageData.rant !== undefined) {
                    message.amount = messageData.rant.price_cents / 100;
                    message.currency = "USD";
                }

                newMessages.push(message);
            });

            return newMessages;
        }

        // Called when an EventSource receives a message.
        onEventSourceMessage(es, event) {
            try {
                const json = JSON.parse(event.data);
                switch (json.type) {
                    case "init":
                    case "messages":
                        this.receiveChatPairs(json.data.messages, json.data.users);
                        // Messages sent to Rumble are also received as a message in the EventStream.
                        break;
                    default:
                        this.debug("EventSource received data with unknown type.", json);
                        break;
                }
            }
            catch (e) {
                this.log("EventSource received data with invalid JSON.", e, event.data);
            }
        }

        async onFetchResponse(response) {
            const url = new URL(response.url);
            if (url.searchParams.get('name') == "emote.list") {
                await response.json().then((json) => {
                    json.data.items.forEach((channel) => {
                        if (channel.emotes !== undefined && channel.emotes.length > 0) {
                            channel.emotes.forEach((emote) => {
                                // emotes_pack_id: 1881816
                                // file: "https://ak2.rmbl.ws/z12/F/3/4/s/F34si.aaa.png"
                                // id: 139169247
                                // is_subs_only: false
                                // moderation_status: "NOT_MODERATED"
                                // name: "r+rumblecandy"
                                // pack_id: 1881816
                                // position: 0
                                this.emotes[emote.name] = emote.file;
                            });
                        }
                    });
                });
            }
        }
    }

    switch (window.location.hostname) {
        case 'kick.com':
            new Kick;
            break;
        case 'rumble.com':
            new Rumble;
            break;
        default:
            console.log(`[SNEED] No platform detected for ${window.location.hostname}.`);
            break;
    }
})();