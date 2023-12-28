// ==UserScript==
// @name S.N.E.E.D. (Kick)
// @version 1.1.0
// @description Stream Nexus userscript for Kick chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @match https://kick.com/*
// @match https://kick.com/*/chatroom
// @connect *
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_listValues
// @grant GM_addValueChangeListener
// @grant GM_openInTab
// @grant GM_xmlhttpRequest
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.deleteValue
// @grant GM.listValues
// @grant GM.openInTab
// @grant GM.xmlHttpRequest
// @run-at document-start
// ==/UserScript==

(async function () {
    'use strict';

    console.log("[SNEED] Attaching to Kick.");
    const PLATFORM = "Kick";
    const CHANNEL_NAME = window.location.href.split("/").filter(x => x).pop();
    const CHANNEL_ID = await fetch(`https://kick.com/api/v2/channels/${CHANNEL_NAME}`).then(response => response.json()).then(data => data.id);

    //
    // Fetch Chat History
    //
    fetch(`https://kick.com/api/v2/channels/${CHANNEL_ID}/messages`)
        .then(response => response.json())
        .then(json => {
            MESSAGE_QUEUE = HANDLE_MESSAGES(json.data.messages.reverse());
        });

    //
    // Monkeypatch WebSocket
    //
    if (WebSocket.prototype.send.sneed_patched === undefined) {
        console.log("[SNEED] Monkeypatching WebSocket");
        WebSocket.prototype.oldSendImpl = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
            this.oldSendImpl(data);
            if (this.sneed_patched === undefined) {
                this.sneed_patched = true;
                this.addEventListener("message", function (msg) {
                    if (this.is_sneed_socket !== true) {
                        const json = JSON.parse(msg.data);

                        if (json.event !== undefined) {
                            HANDLE_EVENT(json);
                        }
                        else if (json.data !== undefined && json.data.messages !== undefined) {
                            let messages = HANDLE_MESSAGES(json.data.messages);
                            if (messages.length > 0) {
                                SEND_MESSAGES(messages);
                            }
                        }
                    }
                }, false);
            }
        };
        WebSocket.prototype.send.sneed_patched = true;
    }

    //
    // Feed Socket
    //
    let CHAT_SOCKET = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    CHAT_SOCKET.is_sneed_socket = true;

    const reconnect = () => {
        // check if socket is connected
        if (CHAT_SOCKET.readyState === WebSocket.OPEN || CHAT_SOCKET.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            CHAT_SOCKET = new WebSocket("ws://127.0.0.2:1350/chat.ws");
            CHAT_SOCKET.is_sneed_socket = true;
        }
    };

    // Connection opened
    CHAT_SOCKET.addEventListener("open", (event) => {
        console.log("[SNEED] Socket connection established.");
        SEND_MESSAGES(MESSAGE_QUEUE);
        MESSAGE_QUEUE = [];
    });

    CHAT_SOCKET.addEventListener("close", (event) => {
        console.log("[SNEED] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function () { reconnect(); }, 3000);
    });

    CHAT_SOCKET.addEventListener("error", (event) => {
        console.log("[SNEED] Socket has errored. Closing.", event.reason);
        alert("The SNEED chat socket could not connect. Ensure the web server is running and that Brave shields are off.");
        socket.close();
    });

    //
    // Chat Messages
    //
    let MESSAGE_QUEUE = [];
    const CREATE_MESSAGE = () => {
        return {
            id: crypto.randomUUID(),
            platform: PLATFORM,
            username: "DUMMY_USER",
            message: "",
            sent_at: Date.now(), // System timestamp for display ordering.
            received_at: Date.now(), // Local timestamp for management.
            avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
            amount: 0,
            currency: "ZWL",
            is_verified: false,
            is_sub: false,
            is_mod: false,
            is_owner: false,
            is_staff: false,
        };
    };

    const HANDLE_EVENT = (json) => {
        switch (json.event) {
            case "App\\Events\\ChatMessageEvent":
                let messages = HANDLE_MESSAGES([JSON.parse(json.data)]);
                if (messages.length > 0) {
                    SEND_MESSAGES(messages);
                }
        }
    };

    const HANDLE_MESSAGES = (data) => {
        const messages = [];

        data.forEach((messageData) => {
            let message = CREATE_MESSAGE();
            message.id = messageData.id; // Kick generously supplies its own messages with UUIDs.
            message.sent_at = Date.parse(messageData.created_at);

            message.username = messageData.sender.username;
            message.message = messageData.content;

            // Emotes are supplied as bbcode: [emote:37221:EZ]
            // Image file found at: https://files.kick.com/emotes/37221/fullsize
            // <img data-v-31c262c8="" data-emote-name="EZ" data-emote-id="37221" src="https://files.kick.com/emotes/37221/fullsize" alt="EZ" class="chat-emote">
            message.message.replace(/\[emote:(\d+):([^\]]+)\]/g, (match, id, name) => {
                message.message = message.message.replace(match, `<img src="https://files.kick.com/emotes/${id}/fullsize" alt="${name}" class="emote" />`);
            });

            messageData.sender.identity.badges.forEach((badge) => {
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
                        console.log(`[SNEED] Unknown badge type: ${badge.type}`);
                        break;
                }
            });

            messages.push(message);
        });

        return messages;
    };

    const SEND_MESSAGES = (messages) => {
        // check if socket is open
        if (CHAT_SOCKET.readyState === WebSocket.OPEN) {
            CHAT_SOCKET.send(JSON.stringify({
                platform: PLATFORM,
                messages: messages,
            }));
        }
        else {
            // add to queue if not
            messages.forEach((message) => {
                MESSAGE_QUEUE.push(messages);
            });
        }
    };
})();

// wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=7.6.0&flash=false
// Chat message
// {"event":"App\\Events\\ChatMessageEvent","data":"{\"id\":\"b2af4980-9dfa-4822-960d-0e64704e2ced\",\"chatroom_id\":2507974,\"content\":\"more in premiere\",\"type\":\"message\",\"created_at\":\"2023-12-24T22:05:00+00:00\",\"sender\":{\"id\":1247649,\"username\":\"tayloredbydrew\",\"slug\":\"tayloredbydrew\",\"identity\":{\"color\":\"#FF9D00\",\"badges\":[]}}}","channel":"chatrooms.2507974.v2"}
// User banned
// {"event":"App\\Events\\UserBannedEvent","data":"{\"id\":\"a3aadb10-22ae-4081-ba8f-46bb9a6c89ff\",\"user\":{\"id\":25556531,\"username\":\"JohnsonAndJohnson1\",\"slug\":\"johnsonandjohnson1\"},\"banned_by\":{\"id\":0,\"username\":\"covid1942\",\"slug\":\"covid1942\"}}","channel":"chatrooms.2507974.v2"}

// Replays
// https://kick.com/api/v2/channels/2515504/messages?start_time=2023-12-27T09:56:53.956Z
// {"status":{"error":false,"code":200,"message":"SUCCESS"},"data":{"messages":[{"id":"9f66bb74-7d3b-455a-9ec0-81ded5a2a2ab","chat_id":2515504,"user_id":22815045,"content":"I just took a dab and the dab genie told me gems bonanza is gonna hit","type":"message","metadata":null,"created_at":"2023-12-27T09:56:57Z","sender":{"id":22815045,"slug":"wickenchingz","username":"WickenChingz","identity":{"color":"#1475E1","badges":[{"type":"subscriber","text":"Subscriber","count":1,"active":true},{"type":"sub_gifter","text":"Sub Gifter","count":2,"active":true}]}}}],"cursor":"1703671158445374","pinned_message":null}}
