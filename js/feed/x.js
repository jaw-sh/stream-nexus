// ==UserScript==
// @name S.N.E.E.D. (𝕏)
// @version 1.0.0
// @description Stream Nexus userscript for Rumble chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>, y-a-t-s
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://twitter.com/i/broadcasts/*
// @include https://x.com/i/broadcasts/*
// @connect *
// @sandbox JavaScript
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

//
// CONTENT-SECURITY-POLICY (CSP) NOTICE
// X blocks outbound connections via connect-src, including to local servers.
// You have to run another extension to edit the policy.
//
// https://chromewebstore.google.com/detail/content-security-policy-o/lhieoncdgamiiogcllfmboilhgoknmpi?hl=en
// ["https://twitter\\.com", [["connect-src", "connect-src ws://127.0.0.2:1350"]]]
//

(function () {
    'use strict';

    console.log("[SNEED] Attaching to 𝕏, the social media platform formerly known as Twitter.");
    const PLATFORM = "X";

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
                        const data = JSON.parse(msg.data);
                        switch (data.kind) {
                            // chat messages and random junk
                            case 1:
                                const payload = JSON.parse(data.payload);
                                if (payload.sender !== undefined && payload.body !== undefined) {
                                    const body = JSON.parse(payload.body);
                                    // Filter updates that do not include text.
                                    if (body.body !== undefined) {
                                        console.log(payload.sender, body);
                                        const messages = HANDLE_MESSAGES([{
                                            sender: payload.sender,
                                            body: body
                                        }]);
                                        if (messages.length > 0) {
                                            SEND_MESSAGES(messages);
                                        }
                                    }
                                }
                                else {
                                    console.log("[SNEED::X] Unknown message type:", data);
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
                }, false);
            }
        };
        WebSocket.prototype.send.sneed_patched = true;
    }

    //
    // Feed Socket
    //
    let CHAT_SOCKET = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (CHAT_SOCKET.readyState === WebSocket.OPEN || CHAT_SOCKET.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            CHAT_SOCKET = new WebSocket("ws://127.0.0.2:1350/chat.ws");
        }
    };

    // Connection opened
    CHAT_SOCKET.addEventListener("open", (event) => {
        console.log("[SNEED::X] Socket connection established.");
        SEND_MESSAGES(MESSAGE_QUEUE);
        MESSAGE_QUEUE = [];
    });

    CHAT_SOCKET.addEventListener("close", (event) => {
        console.log("[SNEED::X] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function () { reconnect(); }, 3000);
    });

    CHAT_SOCKET.addEventListener("error", (event) => {
        console.log("[SNEED::X] Socket has errored. Closing.", event.reason);
        alert("The SNEED chat socket could not connect. Ensure the web server is running and that Brave shields are off.");
        CHAT_SOCKET.close();
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

    const HANDLE_MESSAGES = (pairs) => {
        var messages = [];

        pairs.forEach((pair) => {
            var message = CREATE_MESSAGE();

            message.id = pair.body.uuid;
            message.username = pair.body.username;
            message.message = pair.body.body;
            message.sent_at = pair.body.timestamp;
            message.avatar = pair.sender.profile_image_url;
            message.is_verified = pair.sender.verified ?? false;

            messages.push(message);
        });

        return messages;
    }

    const SEND_MESSAGES = (messages) => {
        // check if socket is open
        if (CHAT_SOCKET.readyState === WebSocket.OPEN) {
            CHAT_SOCKET.send(JSON.stringify({
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
})();

// wss://prod-chatman-ancillary-us-east-1.pscp.tv/chatapi/v1/chatnow
// {"kind":2,"payload":"{\"kind\":4,\"sender\":{\"user_id\":\"\"},\"body\":\"{\\\"room\\\":\\\"1BRKjPMNNLwJw\\\",\\\"occupancy\\\":917,\\\"total_participants\\\":22502}\"}"}
// {"kind":1,"payload":"{\"room\":\"1BRKjPMNNLwJw\",\"body\":\"{\\\"displayName\\\":\\\"Melatonin Milk\\\",\\\"ntpForBroadcasterFrame\\\":16805325508156780544,\\\"ntpForLiveFrame\\\":16805325414151380992,\\\"participant_index\\\":1234993348,\\\"programDateTime\\\":\\\"2023-12-28T23:25:33.008+0000\\\",\\\"remoteID\\\":\\\"1dvKObwBdybQX\\\",\\\"timestamp\\\":1703805954783,\\\"type\\\":2,\\\"uuid\\\":\\\"B56ABCAD-0792-4840-9898-F1D7240601DA\\\",\\\"v\\\":2}\",\"lang\":\"\",\"sender\":{\"user_id\":\"1dvKObwBdybQX\",\"participant_index\":1234993348,\"twitter_id\":\"1445187259595169801\"},\"timestamp\":1703805954891216064}","signature":"3uoKIT2jhEZA6F5tQ_NBFMSU85zGX-rwbzyl7tw"}
// {"kind":1,"payload":"{\"room\":\"1BRKjPMNNLwJw\",\"body\":\"{\\\"body\\\":\\\"I like trump but I think you are a better version of him\\\",\\\"displayName\\\":\\\"Maurin\\\",\\\"ntpForBroadcasterFrame\\\":16805325789220366336,\\\"ntpForLiveFrame\\\":16805325692963811328,\\\"participant_index\\\":1948053463,\\\"programDateTime\\\":\\\"2023-12-28T23:26:37.952+0000\\\",\\\"remoteID\\\":\\\"12740510\\\",\\\"timestamp\\\":1703806020307,\\\"type\\\":1,\\\"username\\\":\\\"maurinurrutia\\\",\\\"uuid\\\":\\\"C7937812-C85A-43E2-8803-D9A2B163E67C\\\",\\\"v\\\":2}\",\"lang\":\"en-us\",\"sender\":{\"user_id\":\"12740510\",\"username\":\"maurinurrutia\",\"display_name\":\"Maurin\",\"profile_image_url\":\"https://pbs.twimg.com/profile_images/1590517650035195907/II3aAR4K_reasonably_small.jpg\",\"participant_index\":1948053463,\"locale\":\"en\",\"verified\":true,\"twitter_id\":\"277934186\",\"lang\":[\"en\"]},\"timestamp\":1703806020409601023,\"uuid\":\"C7937812-C85A-43E2-8803-D9A2B163E67C\"}","signature":"3ddi0FqY0fshHTkqAqzaoXmRvM4jTBne9cT1xww"}
// https://prod-chatman-ancillary-us-west-2.pscp.tv/chatapi/v1/history