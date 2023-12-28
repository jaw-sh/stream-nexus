// ==UserScript==
// @name S.N.E.E.D. (Rumble)
// @version 1.0.0
// @description Stream Nexus userscript for Rumble chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://rumble.com/v*.html
// @include https://rumble.com/chat/popup/*
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

document.addEventListener('DOMContentLoaded', async function () {
    'use strict';

    console.log("[SNEED] Attaching to Rumble.");
    const UUID = await import('https://jspm.dev/uuid');
    const NAMESPACE = "5ceefcfb-4aa5-443a-bea6-1f8590231471";
    const PLATFORM = "Rumble";

    //
    // Live Counter
    //
    (function () {
        let previous = 0;
        const observer = new MutationObserver(function (mutations, observer) {
            const value = parseInt(mutations[0].target.innerText.trim().replace(/,/g, ''), 10); // turns "504 watching" to 504
            if (!isNaN(value) && value != previous) {
                previous = value;
                console.log("[SNEED] Updating viewers:", value);
            }
        });
        observer.observe(document.getElementsByClassName("video-header-live-info")[0], {
            attributes: false,
            childList: true,
            subtree: true
        });
    })();

    //
    // Chat Socket
    //
    const WS_CHAT = new EventSource(`https://web7.rumble.com/chat/api/chat/${document.getElementsByClassName("rumbles-vote-pill")[0].dataset.id}/stream`, { withCredentials: true });
    WS_CHAT.onmessage = function (event) {
        switch (event.type) {
            case "init":
            case "message":
                let messages = HANDLE_MESSAGES(JSON.parse(event.data));
                if (messages.length > 0) {
                    SEND_MESSAGES(messages);
                }
                break;
        }
    };
    WS_CHAT.error = function () {
        if (WS_CHAT.readyState == 2 && !reconnection_timeout_id) {
            reconnection_timeout_id = setTimeout(
                function () {
                    reconnection_timeout_id = 0;
                    if (should_keep_alive) {
                        eventSource = rumbleSocketConnect();
                    }
                },
                3000,
            );
        }
    };

    //
    // SNEED Socket
    //
    const WS_SNEED = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    const WS_SNEED_RECONNECT = () => {
        // check if socket is connected
        if (WS_SNEED.readyState === WebSocket.OPEN || WS_SNEED.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            WS_SNEED = new WebSocket("ws://127.0.0.2:1350/chat.ws");
        }
    };

    // Connection opened
    WS_SNEED.addEventListener("open", (event) => {
        console.log("[SNEED] Socket connection established.");
        SEND_MESSAGES(MESSAGE_QUEUE);
        MESSAGE_QUEUE = [];
    });

    WS_SNEED.addEventListener("close", (event) => {
        console.log("[SNEED] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(WS_SNEED_RECONNECT, 3000);
    });

    WS_SNEED.addEventListener("error", (event) => {
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

    const HANDLE_MESSAGES = (json) => {
        const messages = [];
        const data = json.data;

        if (data.messages === undefined || data.users === undefined) {
            console.log("[SNEED] Unexpected input:", data);
            return messages;
        }

        data.messages.forEach((messageData, index) => {
            const message = CREATE_MESSAGE();
            const user = data.users.find((user) => user.id === messageData.user_id);
            if (user === undefined) {
                console.log("[SNEED] User not found:", messageData.user_id);
                return;
            }

            message.id = UUID.v5(messageData.id, NAMESPACE);
            message.sent_at = Date.parse(messageData.time);
            message.message = messageData.text;

            message.username = user.username;
            if (user['image.1'] !== undefined) {
                message.avatar = user['image.1'];
            }

            if (user.badges !== undefined) {
                user.badges.forEach((badge) => {
                    switch (badge) {
                        case "admin":
                            message.is_staff = true;
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
                            console.log(`[SNEED] Unknown badge type: ${badge.type}`);
                            break;
                    }
                });
            }

            if (messageData.rant !== undefined) {
                message.amount = messageData.rant.price_cents / 100;
                message.currency = "USD";
            }

            messages.push(message);
        });

        return messages;
    }

    const SEND_MESSAGES = (messages) => {
        // check if socket is open
        if (WS_SNEED.readyState === WebSocket.OPEN) {
            WS_SNEED.send(JSON.stringify({
                platform: PLATFORM,
                messages: messages
            }));
        }
        else {
            // add to queue if not
            messages.forEach((message) => {
                MESSAGE_QUEUE.push(messages);
            });
        }
    };
});

//
// JSON API
//

// Main stream
// https://web7.rumble.com/chat/api/chat/####/stream?popup=true

// {"request_id":"mPdI9yjgFCa7TJ9r+iV0SFBZpj6TMb98x58FCf+n/dM","type":"messages","data":{"messages":[{"id":"1338270737490918023","time":"2023-12-24T22:07:28+00:00","user_id":"44434731","text":"If you are not eating your girls pussy someone else is","blocks":[{"type":"text.1","data":{"text":"If you are not eating your girls pussy someone else is"}}]}],"users":[{"id":"44434731","username":"Trudeauisretarded","link":"/user/Trudeauisretarded","is_follower":true,"image.1":"https://ak2.rmbl.ws/z0/R/u/G/P/RuGPc.asF-Trudeauisretarded-qy2hg0.jpeg","color":"#c38b1b"}],"channels":[[]]}}

//{
//    "id": "1343552535046803304",
//    "time": "2023-12-28T15:40:23+00:00",
//    "user_id": "122198260",
//    "text": "LMAO",
//    "blocks": [
//      {
//        "type": "text.1",
//        "data": {
//          "text": "LMAO"
//        }
//      }
//    ],
//    "rant": {
//      "price_cents": 100,
//      "duration": 120,
//      "expires_on": "2023-12-28T15:42:23+00:00"
//    }
//  },

// Viewer update
// https://wn0.rumble.com/service.php?api=7&name=video.watching-now&included_js_libs=main%2Cweb_services%2Cevents%2Cerror%2Cfacebook_events%2Cdarkmode%2Crandom%2Clocal_storage%2Ccontext-menus%2Cnotify%2Cprovider%2Cui_header%2Cmain-menu-item-hover%2Csearch-bar%2Chtmx.org%2Cuser_notifications%2Cui&included_css_libs=global
//
// Payload
// video_id: 243902472
// viewer_id: b-Ghl6CWGkE