// ==UserScript==
// @name S.N.E.E.D. (VK)
// @version 1.0.0
// @description Stream Nexus userscript for VK live chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://vk.com/video/lives?z=*
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

(function () {
    'use strict';

    //
    // Socket Logic
    //
    let CHAT_SOCKET = new WebSocket("ws://localhost:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (CHAT_SOCKET.readyState === WebSocket.OPEN || CHAT_SOCKET.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            CHAT_SOCKET = new WebSocket("ws://localhost:1350/chat.ws");
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
            platform: "IDK",
            username: "DUMMY_USER",
            message: "",
            sent_at: Date.now(), // System timestamp for display ordering.
            received_at: Date.now(), // Local timestamp for management.
            avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
            is_premium: false,
            amount: 0,
            currency: "ZWL",
            is_verified: false,
            is_sub: false,
            is_mod: false,
            is_owner: false,
            is_staff: false,
        };
    };

    const BIND_MUTATION_OBSERVER = () => {
        const targetNode = GET_CHAT_CONTAINER();

        if (targetNode === null) {
            return false;
        }

        if (document.querySelector(".sneed-chat-container") !== null) {
            console.log("[SNEED] Chat container already bound, aborting.");
            return false;
        }

        targetNode.classList.add("sneed-chat-container");

        const observer = new MutationObserver(MUTATION_OBSERVE);
        observer.observe(targetNode, {
            childList: true,
            attributes: false,
            subtree: false
        });

        GET_EXISTING_MESSAGES();
        return true;
    };

    const MUTATION_OBSERVE = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                const messages = HANDLE_MESSAGES(mutation.addedNodes);
                if (messages.length > 0) {
                    SEND_MESSAGES(messages);
                }
            }
        }
    };

    const SEND_MESSAGES = (messages) => {
        // check if socket is open
        if (CHAT_SOCKET.readyState === WebSocket.OPEN) {
            CHAT_SOCKET.send(JSON.stringify(messages));
        }
        else {
            // add to queue if not
            messages.forEach((message) => {
                MESSAGE_QUEUE.push(messages);
            });
        }
    };

    setInterval(function () {
        if (document.querySelector(".sneed-chat-container") === null) {
            console.log("[SNEED] Binding chat container.")
            BIND_MUTATION_OBSERVER();
        }
    }, 1000);


    //
    // Specific Implementations
    //

    const GET_CHAT_CONTAINER = () => {
        return document.querySelector(".mv_chat_messages .ui_scroll_content");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED] Checking for existing messages.");
        const nodes = document.querySelectorAll(".sneed-chat-container .mv_chat_message");

        if (nodes.length > 0) {
            const messages = HANDLE_MESSAGES(nodes);
            if (messages.length > 0) {
                SEND_MESSAGES(messages);
            }
        }
    };

    const HANDLE_MESSAGES = (nodes) => {
        const messages = [];

        nodes.forEach((node) => {
            let message = CREATE_MESSAGE();
            message.platform = "VK";
            message.avatar = node.querySelector(".mv_chat_message_author_thumb_img").src ?? message.avatar;

            // VK does not have superchats as far as I'm aware.
            message.username = node.querySelector(".mv_chat_message_author_name_text").innerText;
            message.message = node.querySelector(".mv_chat_message_text").innerHTML;
            message.is_premium = false;

            // I don't think VK has badges either??

            messages.push(message);
        });

        return messages;
    };
})();

// jesus christ this is nice and easy
// 
// <div class="mv_chat_message " id="mv_chat_msg-25380626_476098" data-msg-id="476098">
//   <a class="mv_chat_message_author_thumb" href="/podstanicky" target="_blank">
//     <img loading="lazy" class="mv_chat_message_author_thumb_img" src="https://sun6-23.userapi.com/s/v1/ig2/afVd5nKHKmQJXPSe8vexHvk4o0N-Q-jbF8khkMpJ2jwZ-EE3P_Hze4rP3yta9i3jYSNoDXKsRQrnS9sXl73VnAJ8.jpg?size=50x50&amp;quality=96&amp;crop=512,192,1536,1536&amp;ava=1">
//   </a>
//   <div class="mv_chat_message_content">
//     <a class="mv_chat_message_author_name" href="/podstanicky" target="_blank"><div class="mv_chat_message_author_name_text">Leo Podstanicky</div></a>
//     <div class="mv_chat_message_text">spasibo</div>
//   </div>
//   <div class="mv_chat_message_actions"><a class="mv_chat_message_action" onclick="VideoChat.showReportVideoChatCommentForm(-25380626, 476098)" aria-label="Report" onmouseover="showTooltip(this, {text:  'Report', black: 1, shift: [0, 8, 0], center: 1})">
//   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 5.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 10 5.5Zm-.9 8.4a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0Z"></path><path fill-rule="evenodd" d="m17.33 14.81-2.52 2.52c-.43.43-.65.65-.9.8a2.5 2.5 0 0 1-.72.3c-.29.07-.6.07-1.2.07H8c-.6 0-.91 0-1.2-.07a2.5 2.5 0 0 1-.72-.3 5.29 5.29 0 0 1-.9-.8L2.66 14.8c-.43-.43-.65-.64-.8-.9a2.5 2.5 0 0 1-.3-.72c-.07-.29-.07-.6-.07-1.2V8c0-.6 0-.91.07-1.2a2.5 2.5 0 0 1 .3-.72c.15-.26.37-.47.8-.9L5.2 2.67c.43-.43.64-.65.9-.8a2.5 2.5 0 0 1 .72-.3c.29-.07.6-.07 1.2-.07h3.97c.61 0 .92 0 1.2.07a2.5 2.5 0 0 1 .73.3c.25.15.47.37.9.8l2.52 2.52c.43.43.64.64.8.9.14.22.24.46.3.72.07.29.07.6.07 1.2V12c0 .6 0 .91-.07 1.2a2.5 2.5 0 0 1-.3.72c-.16.26-.37.47-.8.9Zm-.48-1.7c-.06.1-.15.19-.32.36l-3.06 3.06c-.18.17-.26.26-.36.32a1 1 0 0 1-.3.12c-.1.03-.23.03-.47.03H7.66c-.24 0-.37 0-.48-.03a1 1 0 0 1-.29-.12c-.1-.06-.19-.15-.36-.32l-3.06-3.06a2.06 2.06 0 0 1-.32-.36 1 1 0 0 1-.12-.3c-.03-.1-.03-.23-.03-.47V7.66c0-.24 0-.36.03-.48a1 1 0 0 1 .12-.29c.06-.1.15-.19.32-.36l3.06-3.06c.17-.17.26-.26.36-.32a1 1 0 0 1 .3-.12c.1-.03.23-.03.47-.03h4.67c.25 0 .37 0 .49.03a1 1 0 0 1 .29.12c.1.06.18.15.36.32l3.06 3.06c.17.17.26.26.32.36.06.1.1.19.12.3.03.1.03.23.03.47v4.68c0 .24 0 .36-.03.48a1 1 0 0 1-.12.29Z" clip-rule="evenodd"></path></svg>
// </a></div>
// </div>

<div class="mv_chat_message " id="mv_chat_msg512461907_1005" data-msg-id="1005">
    <a class="mv_chat_message_author_thumb" href="/randomguy322" target="_blank">
        <img loading="lazy" class="mv_chat_message_author_thumb_img" src="https://sun25-1.userapi.com/s/v1/if1/CQIyGUBwD8NTNxd3vnGWvJ9ZHULALfUusYp9fJoCGOu_Wwwa0yoxtoMJ7XAtT2rBcGjWJOu7.jpg?size=50x50&amp;quality=96&amp;crop=303,27,445,445&amp;ava=1">
    </a>
    <div class="mv_chat_message_content">
        <a class="mv_chat_message_author_name" href="/randomguy322" target="_blank">기억 하다</a>
        <div class="mv_chat_message_text">Sneedin' and feedin' Hi Jewsh</div>
    </div>
    <div class="mv_chat_message_actions"><div class="ui_actions_menu_wrap _ui_menu_wrap mv_chat_message_action" onmouseover="window.uiActionsMenu &amp;&amp; uiActionsMenu.show(this, event, {delay: 200, appendParentCls: 'mv_chat', autopos: true, wrapAttrs: {onclick: 'uiActionsMenu.hide(this);'}});" onmouseout="window.uiActionsMenu &amp;&amp; uiActionsMenu.hide(this);">
        <svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M15 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="currentColor"></path></svg>
        <div class="ui_actions_menu _ui_menu mv_chat_message_action_menu" onmouseover="VideoChat.showActionsMenu(512461907, 1005);" onmouseout="VideoChat.hideActionsMenu(512461907, 1005);"><a class="ui_actions_menu_item ui_actions_menu_item_with_icon" onclick="VideoChat.pinMessage(512461907, 505328829, '기억 하다', '/randomguy322', false, 1005, true, true);" tabindex="0" role="link"><div class="ui_actions_menu_item_icon"><svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><g id="pin_outline_20__Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="pin_outline_20__Icons-20/pin_outline_20"><g id="pin_outline_20__pin_outline_20"><path d="M0 0h20v20H0z"></path><path d="M11.33 2.6a.75.75 0 0 1 1.27-.38l5.18 5.18a.75.75 0 0 1-.38 1.27l-1.54.3a.3.3 0 0 0-.15.09l-2.47 2.46a.3.3 0 0 0-.08.19l-.3 3.86a1.01 1.01 0 0 1-1.72.63L8 13.07l-4.72 4.71a.75.75 0 0 1-1.13-.98l.07-.08L6.93 12 3.8 8.87c-.37-.37-.4-.94-.09-1.34l.09-.1c.17-.17.4-.27.63-.29l3.86-.3a.3.3 0 0 0 .19-.08l2.46-2.46a.3.3 0 0 0 .08-.16Zm1.2 1.67-.03.17a1.8 1.8 0 0 1-.5.92L9.54 7.82c-.3.3-.7.49-1.13.52l-2.8.22 5.83 5.83.22-2.8c.03-.37.17-.73.41-1.01l.11-.12L14.64 8c.26-.25.58-.42.92-.5l.17-.03-3.2-3.2Z" id="pin_outline_20__Icon-Color" fill="currentColor" fill-rule="nonzero"></path></g></g></g></svg></div>Pin to chat</a><a class="ui_actions_menu_item mv_chat_message_show_action_true ui_actions_menu_item_with_icon" onclick="VideoChat.deleteMessage('512461907_1005', '1693951309_7292f8dcce70ef8219');" tabindex="0" role="link"><div class="ui_actions_menu_item_icon"><svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M4.72 4.72c.3-.3.77-.3 1.06 0L10 8.94l4.22-4.22a.75.75 0 1 1 1.06 1.06L11.06 10l4.22 4.22a.75.75 0 1 1-1.06 1.06L10 11.06l-4.22 4.22a.75.75 0 0 1-1.06-1.06L8.94 10 4.72 5.78a.75.75 0 0 1 0-1.06z" fill="currentColor" fill-rule="evenodd"></path></svg></div>Delete</a><a class="ui_actions_menu_item mv_chat_message_show_action_true ui_actions_menu_item_with_icon" onclick="VideoChat.showReportVideoChatCommentForm(512461907, 1005);" tabindex="0" role="link"><div class="ui_actions_menu_item_icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 5.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 10 5.5Zm-.9 8.4a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0Z"></path><path fill-rule="evenodd" d="m17.33 14.81-2.52 2.52c-.43.43-.65.65-.9.8a2.5 2.5 0 0 1-.72.3c-.29.07-.6.07-1.2.07H8c-.6 0-.91 0-1.2-.07a2.5 2.5 0 0 1-.72-.3 5.29 5.29 0 0 1-.9-.8L2.66 14.8c-.43-.43-.65-.64-.8-.9a2.5 2.5 0 0 1-.3-.72c-.07-.29-.07-.6-.07-1.2V8c0-.6 0-.91.07-1.2a2.5 2.5 0 0 1 .3-.72c.15-.26.37-.47.8-.9L5.2 2.67c.43-.43.64-.65.9-.8a2.5 2.5 0 0 1 .72-.3c.29-.07.6-.07 1.2-.07h3.97c.61 0 .92 0 1.2.07a2.5 2.5 0 0 1 .73.3c.25.15.47.37.9.8l2.52 2.52c.43.43.64.64.8.9.14.22.24.46.3.72.07.29.07.6.07 1.2V12c0 .6 0 .91-.07 1.2a2.5 2.5 0 0 1-.3.72c-.16.26-.37.47-.8.9Zm-.48-1.7c-.06.1-.15.19-.32.36l-3.06 3.06c-.18.17-.26.26-.36.32a1 1 0 0 1-.3.12c-.1.03-.23.03-.47.03H7.66c-.24 0-.37 0-.48-.03a1 1 0 0 1-.29-.12c-.1-.06-.19-.15-.36-.32l-3.06-3.06a2.06 2.06 0 0 1-.32-.36 1 1 0 0 1-.12-.3c-.03-.1-.03-.23-.03-.47V7.66c0-.24 0-.36.03-.48a1 1 0 0 1 .12-.29c.06-.1.15-.19.32-.36l3.06-3.06c.17-.17.26-.26.36-.32a1 1 0 0 1 .3-.12c.1-.03.23-.03.47-.03h4.67c.25 0 .37 0 .49.03a1 1 0 0 1 .29.12c.1.06.18.15.36.32l3.06 3.06c.17.17.26.26.32.36.06.1.1.19.12.3.03.1.03.23.03.47v4.68c0 .24 0 .36-.03.48a1 1 0 0 1-.12.29Z" clip-rule="evenodd"></path></svg></div>Report</a></div>
    </div></div>
</div>