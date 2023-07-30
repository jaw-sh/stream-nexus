window.SNEED_GET_CHAT_CONTAINER = () => {
    return document.querySelector(".chat-list--default .chat-scrollable-area__message-container");
};

// <div class="chat-line__message" data-a-target="chat-line-message" data-a-user="thewolvenmage" tabindex="0" align-items="center">
//     <div class="Layout-sc-1xcs6mc-0 bZVrjx">
//         <div class="Layout-sc-1xcs6mc-0 epGiWx chat-line__message-highlight">
//         </div>
//         <div class="Layout-sc-1xcs6mc-0 bZVrjx chat-line__message-container">
//             <div class="Layout-sc-1xcs6mc-0">
//                 <div class="Layout-sc-1xcs6mc-0 cZxfJz chat-line__no-background">
//                     <div class="Layout-sc-1xcs6mc-0 dyQMib chat-line__username-container">
//                         <span>
//                         </span>
//                         <span class="chat-line__username" role="button" tabindex="0">
//                             <span>
//                                 <span class="chat-author__display-name" data-a-target="chat-message-username" data-a-user="thewolvenmage" data-test-selector="message-username" style="color: rgb(180, 84, 255);">TheWolvenMage
//                                 </span>
//                             </span>
//                         </span>
//                     </div>
//                     <span aria-hidden="true">:
//                     </span>
//                     <span class="" data-a-target="chat-line-message-body">
//                         <span class="text-fragment" data-a-target="chat-message-text">Hottest temp you ever experienced?
//                         </span>
//                     </span>
//                 </div>
//             </div>
//         </div>
//         <div class="Layout-sc-1xcs6mc-0 vNVsi chat-line__icons">
//             <div class="Layout-sc-1xcs6mc-0 gFnnYr chat-line__reply-icon">
//                 <div class="InjectLayout-sc-1i43xsx-0 dVOhMf">
//                     <button class="ScCoreButton-sc-ocjdkq-0 ibtYyW ScButtonIcon-sc-9yap0r-0 iqxxop InjectLayout-sc-1i43xsx-0" aria-label="Click to reply">
//                         <div class="ButtonIconFigure-sc-1emm8lf-0 kgdotM">
//                             <div class="ScIconLayout-sc-1q25cff-0 cMWGQu">
//                                 <div class="ScAspectRatio-sc-18km980-1 hTTohL tw-aspect">
//                                     <div class="ScAspectSpacer-sc-18km980-0 kiiGFY">
//                                     </div>
//                                     <svg width="100%" height="100%" version="1.1" viewBox="0 0 20 20" x="0px" y="0px" aria-hidden="true" focusable="false" class="ScIconSVG-sc-1q25cff-1 dSicFr">
//                                         <path d="M8.5 5.5L7 4L2 9L7 14L8.5 12.5L6 10H10C12.2091 10 14 11.7909 14 14V16H16V14C16 10.6863 13.3137 8 10 8H6L8.5 5.5Z">
//                                         </path>
//                                     </svg>
//                                 </div>
//                             </div>
//                         </div>
//                     </button>
//                 </div>
//             </div>
//         </div>
//     </div>
// </div>

window.SNEED_SCRAPE_EXISTING_MESSAGES = () => {
    const nodes = document.querySelectorAll(".sneed-chat-container .chat-line__message");

    if (nodes.length > 0) {
        window.SNEED_ADD_MESSAGES(window.SNEED_RECEIVE_MESSAGE_NODES(nodes));
    }
};

window.SNEED_RECEIVE_MESSAGE_NODES = (nodes) => {
    const messages = [];
    nodes.forEach((node) => {
        const message = window.SNEED_GET_MESSAGE_DUMMY();

        message.platform = "Twitch";
        message.received_at = Date.now();

        message.username = node.querySelector(".chat-author__display-name").innerText;
        message.message = node.querySelector("span[data-a-target='chat-message-text']").innerText;

        if (node.classList.contains("channel-points-reward-line__icon")) {
            message.is_premium = true;

            // A lot of weird custom units. Alt-text on the icon helps.
            message.currency = node.querySelector(".channel-points-icon__image").getAttribute("alt");
            message.amount = node.querySelector(".user-notice-line div:first-child").innerText;
        }

        node.querySelectorAll(".chat-badge").forEach((badge) => {
            const label = badge.getAttribute("aria-label").replace(/ badge$/, '');
            switch (label) {
                case "Moderator": message.is_mod = true; break;
                case "Prime Gaming":
                // Sub tiers necessitate this ugly hack. A better way probably exists.
                case /Subscriber/.test(label):
                    message.is_sub = true;
                    break;
                case "Verified": message.is_verified = true; break;
                // TODO: Figure out owner badge and maybe custom ones.
            }
        });

        messages.push(message);
    });
    return messages;
};
