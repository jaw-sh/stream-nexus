// ==UserScript==
// @name S.N.E.E.D.
// @version 1.2.1
// @description Stream Nexus userscript.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @downloadURL https://raw.githubusercontent.com/jaw-sh/stream-nexus/master/js/seed.js
// @updateURL https://raw.githubusercontent.com/jaw-sh/stream-nexus/master/js/seed.js
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @match https://kick.com/*
// @match https://kick.com/*/chatroom
// @match https://odysee.com/*
// @match https://odysee.com/$/popout/*
// @match https://rumble.com/v*.html
// @match https://rumble.com/chat/popup/*
// @match https://twitch.tv/*
// @match https://twitch.tv/popout/*/chat
// @match https://www.youtube.com/live_chat?*
// @match https://youtube.com/live_chat?*
// @match https://vk.com/video/lives?z=*
// @match https://twitter.com/i/broadcasts/*
// @match https://x.com/i/broadcasts/*
// @connect *
// @grant unsafeWindow
// @run-at document-start
// ==/UserScript==

//
// CONTENT-SECURITY-POLICY (CSP) NOTICE
// X blocks outbound connections via connect-src, including to local servers.
// You have to run another extension to edit the policy.
//
// https://chromewebstore.google.com/detail/content-security-policy-o/lhieoncdgamiiogcllfmboilhgoknmpi?hl=en
// ["https://twitter\\.com", [["connect-src", "connect-src ws://127.0.0.2:1350"]]]
//

(async function () {
    'use strict';

    const SOCKET_URL = "ws://127.0.0.2:1350/chat.ws";
    const DEBUG = false;

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

            this.bindEvents();
            this.fetchDependencies();
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

        warn(message, ...args) {
            const f = console.warn ?? console.log;
            if (args.length > 0) {
                f(`[SNEED::${this.platform}] ${message}`, ...args);
            }
            else {
                f(`[SNEED::${this.platform}] ${message}`);
            }
        }

        async fetchDependencies() {
            window.UUID = await import('https://jspm.dev/uuid');
        }

        //
        // Page Events
        //
        /// Bind generic events.
        bindEvents() {
            document.addEventListener("DOMContentLoaded", (event) => this.onDocumentReady(event));
            document.addEventListener("DOMContentLoaded", (event) => this.createChatSocket());
        }

        onDocumentReady() {
            this.debug("Document ready.");
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
            const ws_open = this.chatSocket.readyState === WebSocket.OPEN;
            const seed_ready = this.channel !== null;
            if (ws_open && seed_ready) {
                // Send message queue to Rust backend.
                this.chatSocket.send(JSON.stringify({
                    platform: this.platform,
                    channel: this.channel,
                    messages: messages,
                }));
            }
            else {
                // Add messages to queue.
                this.warn("Forcing messages to queue. Socket open:", ws_open, "Seed ready:", seed_ready);
                this.chatMessageQueue.push(...messages);
            }
        }

        /// Sends live viewer counts to the Rust backend.
        sendViewerCount(count) {
            //
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
    // ❌ Capture view counts.
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
                    //{"event":"App\\\\Events\\\\ChatMessageEvent","data":"{â€¦}","channel":"chatrooms.35535.v2"}
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
    // Odysee
    //
    // ✔️ Capture new messages.
    // ✔️ Capture sent messages.
    // ✔️ Capture existing messages.
    // ✔️ Capture emotes.
    // ❌ Capture moderator actions.
    // ✔️ Capture view counts.
    //
    class Odysee extends Seed {
        constructor() {
            const namespace = "d80f03bf-d30a-48e9-9e9f-81616366eefd";
            const platform = "Odysee";
            const channel = window.location.href.split('/').filter(x => x).at(-2);;
            super(namespace, platform, channel);
        }

        receiveChatMessages(json) {
            const messages = this.prepareChatMessages(json);
            this.sendChatMessages(messages);
        }

        prepareChatMessages(json) {
            const messages = [];
            json.forEach((item) => {
                const message = new ChatMessage(
                    UUID.v5(item.comment_id, this.namespace),
                    this.platform,
                    this.channel
                );
                message.avatar = "https://thumbnails.odycdn.com/optimize/s:160:160/quality:85/plain/https://spee.ch/spaceman-png:2.png";
                message.username = item.channel_name;
                message.message = item.comment;
                message.sent_at = ((item.timestamp - 1) * 1000); // Odysee timestamps to round up, which causes messages to appear out of order.

                if (item.is_fiat === true) {
                    message.amount = item.support_amount;
                    message.currency = "USD";
                }

                message.is_owner = item.is_creator ?? false;

                messages.push(message);
            });

            return messages;
        }

        /// Accepts chat histories and outbound messages.
        async onFetchResponse(response) {
            const url = new URL(response.url);
            switch (url.searchParams.get('m')) {
                case "comment.List":
                case "comment.SuperChatList":
                    await response.json().then(async (data) => {
                        if (data.result !== undefined && data.result.items !== undefined) {
                            this.receiveChatMessages(data.result.items);
                        }
                    });
                    break;
                case "comment.Create":
                    await response.json().then(async (data) => {
                        if (data.result !== undefined && data.result.comment_id !== undefined) {
                            this.receiveChatMessages([data.result]);
                        }
                        return data;
                    });
                    break;
                default:
                    break;
            }
        }

        // Called when a websocket receives a message.
        onWebSocketMessage(ws, event) {
            const json = JSON.parse(event.data);
            switch (json.type) {
                case "delta":
                    this.receiveChatMessages([json.data.comment]);
                    break;
                case "removed":
                    //{"type":"removed","data":{"comment":{"channel_id":"6956205bc194579e1a7c134e62355b80bf175843","channel_name":"@TheRedBaron","channel_url":"lbry://@TheRedBaron#6956205bc194579e1a7c134e62355b80bf175843","claim_id":"d826937ad9bf3b7991eada5034c4612389583bc1","comment":"@mati:c Yo, Cool stream the other night btw","comment_id":"be44038f7905fb006c25beecb89818f54064d476234c7f637241eab40c48526f","currency":"","is_fiat":false,"is_hidden":false,"is_pinned":false,"is_protected":false,"signature":"6e839ae4378de454de96d597332ff05ad09133348bbd1e77d7b055c184ba34bd609976e18968fa537a49078eeb8bef3a9243211ba9ca5ed345603687945ab891","signing_ts":"1703974695","support_amount":0,"timestamp":1703974696}}}	
                    break;
                case "viewers":
                    this.sendViewerCount(json.data.connected);
                    break;
                default:
                    this.log(`Unknown update type.`, json);
                    break;
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
    // ❌ Capture view counts.
    //
    class Rumble extends Seed {
        // Rumble emotes must be sideloaded from another request.
        emotes = [];

        constructor() {
            const namespace = "5ceefcfb-4aa5-443a-bea6-1f8590231471";
            const platform = "Rumble";
            const channel = null; // Cannot be determined before DOM is ready.
            super(namespace, platform, channel);
        }

        /// Fetches the channel ID from the DOM.
        onDocumentReady() {
            // Pop-out chat contains the channel ID in the URL.
            if (window.location.href.indexOf('/chat/popup/') >= 0) {
                this.channel = parseInt(window.location.href.split('/').filter(x => x)[4], 10);
            }
            // Otherwise, we need to find the channel ID in the DOM.
            else {
                // Yes, the only place in the DOM the channel ID exists is the upvote button.
                this.channel = parseInt(document.querySelector('.rumbles-vote-pill').dataset.id, 10);
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

    //
    // Twitch
    //
    class Twitch extends Seed {

        constructor() {
            const namespace = "4a342b79-e302-403a-99be-669b5f27b152";
            const platform = "Twitch";
            const is_popout = window.location.href.indexOf('/popout/') >= 0;
            const channel = window.location.href.split('/').filter(x => x).at(is_popout ? 3 : 2);

            if (channel === "p") {
                this.log("Within Twitch static /p/ directory: terminating.");
                return null;
            }
            else {
                return super(namespace, platform, channel);
            }
        }

        // Twitch messages are encoded in a strange way because it is a WebSocket to IRC bridge.
        // It is split into 3 parts by : and the first segment is delineated by ;
        // @
        //   badge-info=;
        //   badges=rplace-2023/1;
        //   color=#FF0000;
        //   display-name=dragogamer48;
        //   emotes=;
        //   first-msg=0;
        //   flags=;
        //   id=b7ce49cb-7b3d-485e-8e54-233b77ac8d91;
        //   mod=0;
        //   returning-chatter=0;
        //   room-id=90075649;
        //   subscriber=0;
        //   tmi-sent-ts=1704653293738;
        //   turbo=0;
        //   user-id=709862804;
        //   user-type=
        // :dragogamer48!dragogamer48@dragogamer48.tmi.twitch.tv PRIVMSG #illojuan
        // :KEK
    }

    //
    // YouTube
    //
    // ✔️ Capture new messages.
    // ✔️ Capture sent messages.
    // ❌ Capture existing messages.
    // ✔️ Capture emotes.
    // ❌ Capture moderator actions.
    // ❌ Capture view counts.
    //
    class YouTube extends Seed {
        constructor() {
            const namespace = "fd60ac36-d6b5-49dc-aee6-b0d87d130582";
            const platform = "YouTube";
            const channel = null; // Cannot be determined before DOM is ready.
            super(namespace, platform, channel);
        }

        prepareChatMessages(actions) {
            const messages = [];

            actions.forEach((action) => {
                const message = new ChatMessage(
                    UUID.v5(action.item.liveChatTextMessageRenderer.id, this.namespace),
                    this.platform,
                    this.channel
                );
                message.username = action.item.liveChatTextMessageRenderer.authorName.simpleText;
                message.avatar = action.item.liveChatTextMessageRenderer.authorPhoto.thumbnails.at(-1).url;
                message.sent_at = parseInt(action.item.liveChatTextMessageRenderer.timestampUsec / 1000);

                action.item.liveChatTextMessageRenderer.message.runs.forEach((run) => {
                    if (run.text !== undefined) {
                        message.message += run.text;
                    }
                    else if (run.emoji !== undefined) {
                        message.message += `<img class="emoji" data-emote="${run.emoji.emojiId}" src="${run.emoji.image.thumbnails.at(-1).url}" alt="${run.emoji.emojiId}" />`;
                    }
                    else {
                        this.log("[SNEED::YouTube] Unknown run.", run);
                    }
                });

                messages.push(message);
            });

            return messages;
        }

        async onDocumentReady(event) {
            this.log("Document ready, preparing to load channel information.");
            const yt = unsafeWindow.ytInitialData;
            let video_id = new URL(window.location.href).searchParams.get("v");
            if (video_id === null) {
                if (yt.continuationContents !== undefined && yt.continuationContents.liveChatContinuation !== undefined) {
                    video_id = yt.continuationContents.liveChatContinuation.continuations[0].invalidationContinuationData.invalidationId.topic.split("~")[1];
                }
                else if (yt.contents.liveChatRenderer !== undefined) {
                    video_id = yt.contents.liveChatRenderer.continuations[0].invalidationContinuationData.invalidationId.topic.split("~")[1];
                }
                else {
                    this.log("Cannot identify video ID.", JSON.parse(JSON.stringify(contents)));
                }
            }
            this.log("Video ID:", video_id);

            const author_url = await fetch(`https://www.youtube.com/oembed?url=http%3A//youtube.com/watch%3Fv%3D${video_id}&format=json`)
                .then(response => response.json())
                .then(json => json.author_url);
            this.log("Author URL:", author_url);
            this.channel = await fetch(author_url)
                .then(response => response.text())
                .then(text => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, "text/html");
                    return doc.querySelector('meta[itemprop="identifier"]').content;
                });
            this.log("Received channel info.", video_id, author_url, this.channel);
        }

        // Called when a fetch's promise is fulfilled.
        async onFetchResponse(response) {
            if (response.url.indexOf("/get_live_chat") >= 0) {
                await response.json().then((json) => {
                    if (
                        json.continuationContents !== undefined &&
                        json.continuationContents.liveChatContinuation !== undefined &&
                        json.continuationContents.liveChatContinuation.actions !== undefined
                    ) {
                        json.continuationContents.liveChatContinuation.actions.forEach((action) => {
                            if (action.addChatItemAction !== undefined) {
                                this.receiveChatMessages([action.addChatItemAction]);
                            }
                            else {
                                this.log("Unknown action.", action);
                            }
                        });
                    }
                });
            }
        }
    }

    //
    // 𝕏
    //
    // ✔️ Capture new messages.
    // ❌ Capture sent messages.
    // ❌ Capture existing messages.
    // ❌ Capture emotes.
    // ⭕ Capture moderator actions.
    // ❌ Capture view counts.
    //
    class X extends Seed {
        constructor() {
            const namespace = "0abb36b8-43ab-40b5-be61-4f2c32a75890";
            const platform = "X";
            const channel = window.location.href.split('/').filter(x => x).at(-1); // Broadcast ID, not channel name.
            super(namespace, platform, channel);
        }

        async fetchDependencies() {
            // X provides UUIDs for messages, and its CSP blocks the import.
        }

        prepareChatMessages(pairs) {
            var messages = [];

            pairs.forEach((pair) => {
                const message = new ChatMessage(pair.body.uuid, this.platform, this.channel);

                message.username = pair.body.username;
                message.message = pair.body.body;
                message.sent_at = pair.body.timestamp;
                message.avatar = pair.sender.profile_image_url;
                message.is_verified = pair.sender.verified ?? false;

                messages.push(message);
            });

            return messages;
        }

        // Called when a websocket receives a message.
        onWebSocketMessage(ws, event) {
            const data = JSON.parse(event.data);
            switch (data.kind) {
                // chat messages and random junk
                case 1:
                    const payload = JSON.parse(data.payload);
                    if (payload.sender !== undefined && payload.body !== undefined) {
                        const body = JSON.parse(payload.body);
                        // Filter updates that do not include text.
                        if (body.body !== undefined) {
                            const messages = this.prepareChatMessages([{
                                sender: payload.sender,
                                body: body
                            }]);
                            if (messages.length > 0) {
                                this.sendChatMessages(messages);
                            }
                        }
                    }
                    else {
                        this.log("[SNEED::X] Unknown message type:", data);
                    }
                    break;
                // viewer counts
                case 2:
                    // "{"kind":4,"sender":{"user_id":""},"body":"{\"room\":\"1vOxwjQLwPmJB\",\"occupancy\":384,\"total_participants\":19922}"}"
                    break;
                default:
                    break;
            }
        }
    }

    //
    // Seed Selection
    //
    switch (window.location.hostname) {
        case 'kick.com':
            new Kick;
            break;
        case 'odysee.com':
            new Odysee;
            break;
        case 'rumble.com':
            new Rumble;
            break;
        case 'twitch':
            new Twitch;
        case 'www.youtube.com':
        case 'youtube.com':
            new YouTube;
            break;
        case "twitter.com":
        case "x.com":
            new X;
            break;
        default:
            console.log(`[SNEED] No platform detected for ${window.location.hostname}.`);
            break;
    }
})();