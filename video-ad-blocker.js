twitch-videoad.js text/javascript
(function() {
    'use strict';
    
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    
    const VERSION = 20; // Enhanced version number
    const SCRIPT_NAME = 'Enhanced Twitch Ad Blocker';
    
    if (typeof unsafeWindow === 'undefined') {
        unsafeWindow = window;
    }
    
    if (typeof unsafeWindow.twitchAdSolutionsVersion !== 'undefined' && unsafeWindow.twitchAdSolutionsVersion >= VERSION) {
        console.log(`[${SCRIPT_NAME}] Skipping - newer version already active. Current: ${VERSION}, Active: ${unsafeWindow.twitchAdSolutionsVersion}`);
        unsafeWindow.twitchAdSolutionsVersion = VERSION;
        return;
    }
    
    unsafeWindow.twitchAdSolutionsVersion = VERSION;
    console.log(`[${SCRIPT_NAME}] v${VERSION} initialized`);
    function declareOptions(scope) {
        // Enhanced options with better defaults and performance optimizations
        scope.OPT_MODE_STRIP_AD_SEGMENTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS = false;
        scope.OPT_PREROLL_BACKUP_PLAYER_TYPES = ['autoplay', 'embed'];
        scope.OPT_MIDROLL_BACKUP_PLAYER_TYPES = ['autoplay', 'picture-by-picture', 'embed'];
        scope.OPT_BACKUP_PLATFORM = 'android';
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = null;
        scope.OPT_SHOW_AD_BANNER = true;
        scope.OPT_ENHANCED_UI = true; // New option for enhanced UI
        scope.OPT_PERFORMANCE_MODE = false; // New option for performance mode
        scope.OPT_DEBUG_MODE = false; // New option for debug logging
        
        // Constants
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.LIVE_SIGNIFIER = ',live';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        
        // Data structures optimized for performance
        scope.StreamInfos = new Map(); // Changed from array to Map for better performance
        scope.StreamInfosByUrl = new Map(); // Changed from array to Map
        scope.CurrentChannelNameFromM3U8 = null;
        
        // Authentication headers
        scope.gql_device_id = null;
        scope.ClientIntegrityHeader = null;
        scope.AuthorizationHeader = null;
        
        // Performance tracking
        scope.performanceStats = {
            adsBlocked: 0,
            streamsProcessed: 0,
            startTime: Date.now()
        };
    }
    var twitchWorkers = [];
    var workerStringConflicts = [
        'twitch',
        'isVariantA'// TwitchNoSub
    ];
    var workerStringAllow = [];
    var workerStringReinsert = [
        'isVariantA',// TwitchNoSub (prior to (0.9))
        'besuper/',// TwitchNoSub (0.9)
        '${patch_url}'// TwitchNoSub (0.9.1)
    ];
    function getCleanWorker(worker) {
        var root = null;
        var parent = null;
        var proto = worker;
        while (proto) {
            var workerString = proto.toString();
            if (workerStringConflicts.some((x) => workerString.includes(x)) && !workerStringAllow.some((x) => workerString.includes(x))) {
                if (parent !== null) {
                    Object.setPrototypeOf(parent, Object.getPrototypeOf(proto));
                }
            } else {
                if (root === null) {
                    root = proto;
                }
                parent = proto;
            }
            proto = Object.getPrototypeOf(proto);
        }
        return root;
    }
    function getWorkersForReinsert(worker) {
        var result = [];
        var proto = worker;
        while (proto) {
            var workerString = proto.toString();
            if (workerStringReinsert.some((x) => workerString.includes(x))) {
                result.push(proto);
            } else {
            }
            proto = Object.getPrototypeOf(proto);
        }
        return result;
    }
    function reinsertWorkers(worker, reinsert) {
        var parent = worker;
        for (var i = 0; i < reinsert.length; i++) {
            Object.setPrototypeOf(reinsert[i], parent);
            parent = reinsert[i];
        }
        return parent;
    }
    function isValidWorker(worker) {
        var workerString = worker.toString();
        return !workerStringConflicts.some((x) => workerString.includes(x))
            || workerStringAllow.some((x) => workerString.includes(x))
            || workerStringReinsert.some((x) => workerString.includes(x));
    }
    function hookWindowWorker() {
        var reinsert = getWorkersForReinsert(unsafeWindow.Worker);
        var newWorker = class Worker extends getCleanWorker(unsafeWindow.Worker) {
            constructor(twitchBlobUrl, options) {
                var isTwitchWorker = false;
                try {
                    isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith('.twitch.tv');
                } catch {}
                if (!isTwitchWorker) {
                    super(twitchBlobUrl, options);
                    return;
                }
                var newBlobStr = `
                    const pendingFetchRequests = new Map();
                    ${processM3U8.toString()}
                    ${hookWorkerFetch.toString()}
                    ${declareOptions.toString()}
                    ${getAccessToken.toString()}
                    ${gqlRequest.toString()}
                    ${makeGraphQlPacket.toString()}
                    ${tryNotifyAdsWatchedM3U8.toString()}
                    ${parseAttributes.toString()}
                    ${setStreamInfoUrls.toString()}
                    ${onFoundAd.toString()}
                    ${getWasmWorkerJs.toString()}
                    var workerString = getWasmWorkerJs('${twitchBlobUrl.replaceAll("'", "%27")}');
                    declareOptions(self);
                    self.addEventListener('message', function(e) {
                        if (e.data.key == 'UboUpdateDeviceId') {
                            gql_device_id = e.data.value;
                        } else if (e.data.key == 'UpdateClientIntegrityHeader') {
                            ClientIntegrityHeader = e.data.value;
                        } else if (e.data.key == 'UpdateAuthorizationHeader') {
                            AuthorizationHeader = e.data.value;
                        } else if (e.data.key == 'FetchResponse') {
                            const responseData = e.data.value;
                            if (pendingFetchRequests.has(responseData.id)) {
                                const { resolve, reject } = pendingFetchRequests.get(responseData.id);
                                pendingFetchRequests.delete(responseData.id);
                                if (responseData.error) {
                                    reject(new Error(responseData.error));
                                } else {
                                    // Create a Response object from the response data
                                    const response = new Response(responseData.body, {
                                        status: responseData.status,
                                        statusText: responseData.statusText,
                                        headers: responseData.headers
                                    });
                                    resolve(response);
                                }
                            }
                        }
                    });
                    hookWorkerFetch();
                    eval(workerString);
                `
                super(URL.createObjectURL(new Blob([newBlobStr])), options);
                twitchWorkers.push(this);
                this.addEventListener('message', (e) => {
                    const { key, value, isMidroll } = e.data;
                    
                    switch (key) {
                        case 'UboShowAdBanner':
                            showEnhancedAdBanner(isMidroll);
                            break;
                        case 'UboHideAdBanner':
                            hideEnhancedAdBanner();
                            break;
                        case 'UboChannelNameM3U8Changed':
                            console.log(`[${SCRIPT_NAME}] Channel changed to: ${value}`);
                            break;
                        case 'UboReloadPlayer':
                            reloadTwitchPlayer();
                            break;
                        case 'UboPauseResumePlayer':
                            reloadTwitchPlayer(false, true);
                            break;
                        case 'UboSeekPlayer':
                            reloadTwitchPlayer(true);
                            break;
                    }
                });
                
                function showEnhancedAdBanner(isMidroll = false) {
                    const adDiv = getAdDiv();
                    if (!adDiv || !OPT_SHOW_AD_BANNER) return;
                    
                    const adType = isMidroll ? 'midroll' : 'preroll';
                    const message = `🛡️ Blocking ${adType} advertisement`;
                    
                    adDiv.textElement.textContent = message;
                    adDiv.style.display = 'block';
                    adDiv.classList.remove('hide');
                    
                    // Start progress animation
                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        progress += 2;
                        adDiv.progressFill.style.width = `${Math.min(progress, 100)}%`;
                        
                        if (progress >= 100) {
                            clearInterval(progressInterval);
                            setTimeout(() => {
                                hideEnhancedAdBanner();
                            }, 500);
                        }
                    }, 50);
                    
                    // Store interval for cleanup
                    adDiv.progressInterval = progressInterval;
                }
                
                function hideEnhancedAdBanner() {
                    const adDiv = getAdDiv();
                    if (!adDiv) return;
                    
                    // Clear progress interval
                    if (adDiv.progressInterval) {
                        clearInterval(adDiv.progressInterval);
                        adDiv.progressInterval = null;
                    }
                    
                    adDiv.classList.add('hide');
                    
                    setTimeout(() => {
                        adDiv.style.display = 'none';
                        adDiv.classList.remove('hide');
                        adDiv.progressFill.style.width = '0%';
                    }, 300);
                }
                this.addEventListener('message', async event => {
                    if (event.data.key == 'FetchRequest') {
                        const fetchRequest = event.data.value;
                        const responseData = await handleWorkerFetchRequest(fetchRequest);
                        this.postMessage({
                            key: 'FetchResponse',
                            value: responseData
                        });
                    }
                });
                function getAdDiv() {
                    const playerRootDiv = document.querySelector('.video-player');
                    if (!playerRootDiv) return null;
                    
                    let adDiv = playerRootDiv.querySelector('.enhanced-ad-overlay');
                    if (!adDiv) {
                        adDiv = createEnhancedAdOverlay();
                        playerRootDiv.appendChild(adDiv);
                    }
                    return adDiv;
                }
                
                function createEnhancedAdOverlay() {
                    const overlay = document.createElement('div');
                    overlay.className = 'enhanced-ad-overlay';
                    overlay.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 1000;
                        display: none;
                        pointer-events: none;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    `;
                    
                    const notification = document.createElement('div');
                    notification.className = 'ad-notification';
                    notification.style.cssText = `
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        background: linear-gradient(135deg, #9146ff 0%, #00d4aa 100%);
                        color: white;
                        padding: 16px 24px;
                        border-radius: 12px;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        font-weight: 600;
                        font-size: 14px;
                        line-height: 1.4;
                        max-width: 300px;
                        transform: translateX(100%);
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        animation: slideInRight 0.5s ease-out forwards;
                    `;
                    
                    const icon = document.createElement('div');
                    icon.innerHTML = '🛡️';
                    icon.style.cssText = `
                        display: inline-block;
                        margin-right: 8px;
                        font-size: 16px;
                        animation: pulse 2s infinite;
                    `;
                    
                    const text = document.createElement('span');
                    text.className = 'ad-notification-text';
                    
                    const progressBar = document.createElement('div');
                    progressBar.className = 'ad-progress-bar';
                    progressBar.style.cssText = `
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        height: 3px;
                        background: rgba(255, 255, 255, 0.3);
                        border-radius: 0 0 12px 12px;
                        overflow: hidden;
                    `;
                    
                    const progressFill = document.createElement('div');
                    progressFill.className = 'ad-progress-fill';
                    progressFill.style.cssText = `
                        height: 100%;
                        background: linear-gradient(90deg, #00d4aa, #9146ff);
                        width: 0%;
                        transition: width 0.3s ease;
                        border-radius: 0 0 12px 12px;
                    `;
                    
                    progressBar.appendChild(progressFill);
                    notification.appendChild(icon);
                    notification.appendChild(text);
                    notification.appendChild(progressBar);
                    overlay.appendChild(notification);
                    
                    // Add CSS animations
                    if (!document.getElementById('enhanced-ad-blocker-styles')) {
                        const style = document.createElement('style');
                        style.id = 'enhanced-ad-blocker-styles';
                        style.textContent = `
                            @keyframes slideInRight {
                                from { transform: translateX(100%); opacity: 0; }
                                to { transform: translateX(0); opacity: 1; }
                            }
                            @keyframes slideOutRight {
                                from { transform: translateX(0); opacity: 1; }
                                to { transform: translateX(100%); opacity: 0; }
                            }
                            @keyframes pulse {
                                0%, 100% { transform: scale(1); }
                                50% { transform: scale(1.1); }
                            }
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(-10px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                            .enhanced-ad-overlay .ad-notification {
                                animation: slideInRight 0.5s ease-out forwards;
                            }
                            .enhanced-ad-overlay.hide .ad-notification {
                                animation: slideOutRight 0.3s ease-in forwards;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                    
                    overlay.textElement = text;
                    overlay.progressFill = progressFill;
                    overlay.notification = notification;
                    
                    return overlay;
                }
            }
        }
        var workerInstance = reinsertWorkers(newWorker, reinsert);
        Object.defineProperty(unsafeWindow, 'Worker', {
            get: function() {
                return workerInstance;
            },
            set: function(value) {
                if (isValidWorker(value)) {
                    workerInstance = value;
                } else {
                    console.log('Attempt to set twitch worker denied');
                }
            }
        });
    }
    function getWasmWorkerJs(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.overrideMimeType("text/javascript");
        req.send();
        return req.responseText;
    }
    function setStreamInfoUrls(streamInfo, encodingsM3u8) {
        var lines = encodingsM3u8.replace('\r', '').split('\n');
        for (var j = 0; j < lines.length; j++) {
            if (!lines[j].startsWith('#') && lines[j].includes('.m3u8')) {
                StreamInfosByUrl[lines[j].trimEnd()] = streamInfo;
            }
        }
    }
    async function onFoundAd(streamInfo, textStr, reloadPlayer, realFetch, url) {
        var result = textStr;
        streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
        var playerTypes = streamInfo.IsMidroll ? OPT_MIDROLL_BACKUP_PLAYER_TYPES : OPT_PREROLL_BACKUP_PLAYER_TYPES;
        if (streamInfo.BackupEncodingsStatus.size >= playerTypes.length) {
            return textStr;
        }
        if (streamInfo.BackupEncodings && !streamInfo.BackupEncodings.includes(url)) {
            // Disabled for now as this may cause some problems
            /*console.log('Double request before it managed to switch to the backup?');
            var streamM3u8Url = streamInfo.BackupEncodings.match(/^https:.*\.m3u8.*$/m)[0];
            var streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status === 200) {
                return await streamM3u8Response.text();
            }*/
        }
        var backupPlayerTypeInfo = '';
        for (var i = 0; i < playerTypes.length; i++) {
            var playerType = playerTypes[i];
            if (!streamInfo.BackupEncodingsStatus.has(playerType)) {
                try {
                    var accessTokenResponse = await getAccessToken(streamInfo.ChannelName, playerType, OPT_BACKUP_PLATFORM);
                    if (accessTokenResponse != null && accessTokenResponse.status === 200) {
                        var accessToken = await accessTokenResponse.json();
                        var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.UsherParams);
                        urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                        urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                        var encodingsM3u8Response = await realFetch(urlInfo.href);
                        if (encodingsM3u8Response != null && encodingsM3u8Response.status === 200) {
                            var encodingsM3u8 = await encodingsM3u8Response.text();
                            var streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8.*$/m)[0];
                            var streamM3u8Response = await realFetch(streamM3u8Url);
                            if (streamM3u8Response.status === 200) {
                                var backTextStr = await streamM3u8Response.text();
                                if (!backTextStr.includes(AD_SIGNIFIER) || streamInfo.BackupEncodingsStatus.size >= playerTypes.length - 1) {
                                    result = backTextStr;
                                    backupPlayerTypeInfo = ' (' + playerType + ')';
                                    streamInfo.BackupEncodingsStatus.set(playerType, 1);
                                    if (playerType !== 'embed') {
                                        // Low resolution streams will reduce the number of resolutions in the UI. To fix this we merge the highest low res into the main m3u8
                                        // TODO: Do a better matching up of the resolutions rather than picking the highest low res for all
                                        var lowResLines = encodingsM3u8.replace('\r', '').split('\n');
                                        var lowResBestUrl = null;
                                        for (var j = 0; j < lowResLines.length; j++) {
                                            if (lowResLines[j].startsWith('#EXT-X-STREAM-INF')) {
                                                var res = parseAttributes(lowResLines[j])['RESOLUTION'];
                                                if (res && lowResLines[j + 1].endsWith('.m3u8')) {
                                                    // Assumes resolutions are correctly ordered
                                                    lowResBestUrl = lowResLines[j + 1];
                                                    break;
                                                }
                                            }
                                        }
                                        if (lowResBestUrl != null && streamInfo.Encodings != null) {
                                            var normalEncodingsM3u8 = streamInfo.Encodings;
                                            var normalLines = normalEncodingsM3u8.replace('\r', '').split('\n');
                                            for (var j = 0; j < normalLines.length - 1; j++) {
                                                if (normalLines[j].startsWith('#EXT-X-STREAM-INF')) {
                                                    var res = parseAttributes(normalLines[j])['RESOLUTION'];
                                                    if (res) {
                                                        lowResBestUrl += ' ';// The stream doesn't load unless each url line is unique
                                                        normalLines[j + 1] = lowResBestUrl;
                                                    }
                                                }
                                            }
                                            encodingsM3u8 = normalLines.join('\r\n');
                                        }
                                    }
                                    streamInfo.BackupEncodings = encodingsM3u8;
                                    setStreamInfoUrls(streamInfo, encodingsM3u8);
                                }
                            }
                        }
                    }
                } catch (err) { console.error(err); }
                if (streamInfo.BackupEncodingsStatus.get(playerType) === 1) {
                    break;
                } else {
                    streamInfo.BackupEncodingsStatus.set(playerType, 0);
                }
            }
        }
        console.log(`[${SCRIPT_NAME}] Found ads, switching to backup${backupPlayerTypeInfo}`);
        
        // Update statistics
        performanceStats.adsBlocked++;
        
        if (reloadPlayer) {
            postMessage({key: 'UboReloadPlayer'});
        }
        postMessage({key: 'UboShowAdBanner', isMidroll: streamInfo.IsMidroll});
        return result;
    }
    async function processM3U8(url, textStr, realFetch) {
        const streamInfo = StreamInfosByUrl.get(url);
        if (!streamInfo) {
            if (OPT_DEBUG_MODE) {
                console.log(`[${SCRIPT_NAME}] Unknown stream URL: ${url}`);
            }
            return textStr;
        }
        
        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return textStr;
        }
        
        const hasAdTags = textStr.includes(AD_SIGNIFIER);
        performanceStats.streamsProcessed++;
        
        try {
            if (streamInfo.BackupEncodings) {
                const streamM3u8Url = streamInfo.Encodings.match(/^https:.*\.m3u8$/m)?.[0];
                if (streamM3u8Url) {
                    const streamM3u8Response = await realFetch(streamM3u8Url);
                    if (streamM3u8Response.status === 200) {
                        const streamM3u8 = await streamM3u8Response.text();
                        if (streamM3u8) {
                            if (!streamM3u8.includes(AD_SIGNIFIER)) {
                                console.log(`[${SCRIPT_NAME}] No more ads on main stream. Switching back...`);
                                streamInfo.BackupEncodings = null;
                                streamInfo.BackupEncodingsStatus.clear();
                                postMessage({key: 'UboHideAdBanner'});
                                postMessage({key: 'UboReloadPlayer'});
                            } else if (!streamM3u8.includes('"MIDROLL"') && !streamM3u8.includes('"midroll"')) {
                                await processAdSegments(streamM3u8, streamInfo);
                            }
                        }
                    }
                }
                
                if (streamInfo.BackupEncodings && hasAdTags) {
                    textStr = await onFoundAd(streamInfo, textStr, true, realFetch, url);
                }
            } else if (hasAdTags) {
                textStr = await onFoundAd(streamInfo, textStr, true, realFetch, url);
            } else {
                postMessage({key: 'UboHideAdBanner'});
            }
        } catch (error) {
            console.error(`[${SCRIPT_NAME}] Error processing M3U8:`, error);
        }
        
        return textStr;
    }
    
    async function processAdSegments(streamM3u8, streamInfo) {
        const lines = streamM3u8.replace(/\r/g, '').split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#EXTINF') && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (!line.includes(LIVE_SIGNIFIER) && !streamInfo.RequestedAds.has(nextLine)) {
                    streamInfo.RequestedAds.add(nextLine);
                    // Fire and forget - don't await to avoid blocking
                    fetch(nextLine).then(response => response.blob()).catch(() => {});
                    break;
                }
            }
        }
    }
    function hookWorkerFetch() {
        console.log(`[${SCRIPT_NAME}] Enhanced fetch hook initialized`);
        const realFetch = fetch;
        
        fetch = async function(url, options) {
            if (typeof url !== 'string') {
                return realFetch.apply(this, arguments);
            }
            
            const trimmedUrl = url.trimEnd();
            
            try {
                if (trimmedUrl.endsWith('m3u8')) {
                    return await handleM3U8Request(trimmedUrl, options, realFetch);
                } else if (trimmedUrl.includes('/api/channel/hls/') && !trimmedUrl.includes('picture-by-picture')) {
                    return await handleChannelHLSRequest(trimmedUrl, options, realFetch);
                }
            } catch (error) {
                console.error(`[${SCRIPT_NAME}] Fetch hook error:`, error);
                return realFetch.apply(this, arguments);
            }
            
            return realFetch.apply(this, arguments);
        };
    }
    
    async function handleM3U8Request(url, options, realFetch) {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await realFetch(url, options);
                if (response.status === 200) {
                    const text = await response.text();
                    const processedText = await processM3U8(url, text, realFetch);
                    resolve(new Response(processedText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    }));
                } else {
                    resolve(response);
                }
            } catch (error) {
                console.error(`[${SCRIPT_NAME}] M3U8 processing error:`, error);
                reject(error);
            }
        });
    }
    
    async function handleChannelHLSRequest(url, options, realFetch) {
        const channelName = new URL(url).pathname.match(/([^\/]+)(?=\.\w+$)/)?.[0];
        if (!channelName) {
            return realFetch.apply(this, arguments);
        }
        
        if (CurrentChannelNameFromM3U8 !== channelName) {
            postMessage({
                key: 'UboChannelNameM3U8Changed',
                value: channelName
            });
        }
        CurrentChannelNameFromM3U8 = channelName;
        
        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return realFetch.apply(this, arguments);
        }
        
        return new Promise(async (resolve, reject) => {
            try {
                let streamInfo = StreamInfos.get(channelName);
                
                // Check if cached encodings are still valid
                if (streamInfo?.Encodings) {
                    const streamM3u8Url = streamInfo.Encodings.match(/^https:.*\.m3u8$/m)?.[0];
                    if (streamM3u8Url) {
                        const testResponse = await realFetch(streamM3u8Url);
                        if (testResponse.status !== 200) {
                            streamInfo = null; // Cache is stale
                        }
                    }
                }
                
                if (!streamInfo) {
                    streamInfo = createStreamInfo(channelName, url);
                    StreamInfos.set(channelName, streamInfo);
                    
                    const encodingsResponse = await realFetch(url, options);
                    if (encodingsResponse.status === 200) {
                        const encodingsM3u8 = await encodingsResponse.text();
                        streamInfo.Encodings = encodingsM3u8;
                        setStreamInfoUrls(streamInfo, encodingsM3u8);
                        
                        const streamM3u8Url = encodingsM3u8.match(/^https:.*\.m3u8$/m)?.[0];
                        if (streamM3u8Url) {
                            const streamResponse = await realFetch(streamM3u8Url);
                            if (streamResponse.status === 200) {
                                const streamM3u8 = await streamResponse.text();
                                if (streamM3u8.includes(AD_SIGNIFIER)) {
                                    await onFoundAd(streamInfo, streamM3u8, false, realFetch, streamM3u8Url);
                                }
                            } else {
                                resolve(streamResponse);
                                return;
                            }
                        }
                    } else {
                        resolve(encodingsResponse);
                        return;
                    }
                }
                
                const responseText = streamInfo.BackupEncodings || streamInfo.Encodings;
                resolve(new Response(responseText));
                
            } catch (error) {
                console.error(`[${SCRIPT_NAME}] Channel HLS processing error:`, error);
                reject(error);
            }
        });
    }
    
    function createStreamInfo(channelName, url) {
        return {
            RequestedAds: new Set(),
            Encodings: null,
            BackupEncodings: null,
            BackupEncodingsStatus: new Map(),
            IsMidroll: false,
            UseFallbackStream: false,
            ChannelName: channelName,
            UsherParams: new URL(url).search
        };
    }
    function makeGraphQlPacket(event, radToken, payload) {
        return [{
            operationName: 'ClientSideAdEventHandling_RecordAdEvent',
            variables: {
                input: {
                    eventName: event,
                    eventPayload: JSON.stringify(payload),
                    radToken,
                },
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '7e6c69e6eb59f8ccb97ab73686f3d8b7d85a72a0298745ccd8bfc68e4054ca5b',
                },
            },
        }];
    }
    function getAccessToken(channelName, playerType, platform) {
        if (!platform) {
            platform = 'web';
        }
        var body = null;
        var templateQuery = 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "' + platform + '", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "' + platform + '", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}';
        body = {
            operationName: 'PlaybackAccessToken_Template',
            query: templateQuery,
            variables: {
                'isLive': true,
                'login': channelName,
                'isVod': false,
                'vodID': '',
                'playerType': playerType
            }
        };
        return gqlRequest(body);
    }
    function gqlRequest(body) {
        if (!gql_device_id) {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            for (let i = 0; i < 32; i += 1) {
                gql_device_id += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        var headers = {
            'Client-Id': CLIENT_ID,
            'Client-Integrity': ClientIntegrityHeader,
            'X-Device-Id': gql_device_id,
            'Authorization': AuthorizationHeader
        };
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(2, 15);
            const fetchRequest = {
                id: requestId,
                url: 'https://gql.twitch.tv/gql',
                options: {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers
                }
            };
            pendingFetchRequests.set(requestId, {
                resolve,
                reject
            });
            postMessage({
                key: 'FetchRequest',
                value: fetchRequest
            });
        });
    }
    function parseAttributes(str) {
        return Object.fromEntries(
            str.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/)
                .filter(Boolean)
                .map(x => {
                    const idx = x.indexOf('=');
                    const key = x.substring(0, idx);
                    const value = x.substring(idx +1);
                    const num = Number(value);
                    return [key, Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num]
                }));
    }
    async function tryNotifyAdsWatchedM3U8(streamM3u8) {
        try {
            //console.log(streamM3u8);
            if (!streamM3u8 || !streamM3u8.includes(AD_SIGNIFIER)) {
                return 1;
            }
            var matches = streamM3u8.match(/#EXT-X-DATERANGE:(ID="stitched-ad-[^\n]+)\n/);
            if (matches.length > 1) {
                const attrString = matches[1];
                const attr = parseAttributes(attrString);
                var podLength = parseInt(attr['X-TV-TWITCH-AD-POD-LENGTH'] ? attr['X-TV-TWITCH-AD-POD-LENGTH'] : '1');
                var podPosition = parseInt(attr['X-TV-TWITCH-AD-POD-POSITION'] ? attr['X-TV-TWITCH-AD-POD-POSITION'] : '0');
                var radToken = attr['X-TV-TWITCH-AD-RADS-TOKEN'];
                var lineItemId = attr['X-TV-TWITCH-AD-LINE-ITEM-ID'];
                var orderId = attr['X-TV-TWITCH-AD-ORDER-ID'];
                var creativeId = attr['X-TV-TWITCH-AD-CREATIVE-ID'];
                var adId = attr['X-TV-TWITCH-AD-ADVERTISER-ID'];
                var rollType = attr['X-TV-TWITCH-AD-ROLL-TYPE'].toLowerCase();
                const baseData = {
                    stitched: true,
                    roll_type: rollType,
                    player_mute: false,
                    player_volume: 0.5,
                    visible: true,
                };
                for (let podPosition = 0; podPosition < podLength; podPosition++) {
                    if (OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS) {
                        // This is all that's actually required at the moment
                        await gqlRequest(makeGraphQlPacket('video_ad_pod_complete', radToken, baseData));
                    } else {
                        const extendedData = {
                            ...baseData,
                            ad_id: adId,
                            ad_position: podPosition,
                            duration: 30,
                            creative_id: creativeId,
                            total_ads: podLength,
                            order_id: orderId,
                            line_item_id: lineItemId,
                        };
                        await gqlRequest(makeGraphQlPacket('video_ad_impression', radToken, extendedData));
                        for (let quartile = 0; quartile < 4; quartile++) {
                            await gqlRequest(
                                makeGraphQlPacket('video_ad_quartile_complete', radToken, {
                                    ...extendedData,
                                    quartile: quartile + 1,
                                })
                            );
                        }
                        await gqlRequest(makeGraphQlPacket('video_ad_pod_complete', radToken, baseData));
                    }
                }
            }
            return 0;
        } catch (err) {
            console.log(err);
            return 0;
        }
    }
    function postTwitchWorkerMessage(key, value) {
        twitchWorkers.forEach((worker) => {
            worker.postMessage({key: key, value: value});
        });
    }
    function makeGmXmlHttpRequest(fetchRequest) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: fetchRequest.options.method,
                url: fetchRequest.url,
                data: fetchRequest.options.body,
                headers: fetchRequest.options.headers,
                onload: response => resolve(response),
                onerror: error => reject(error)
            });
        });
    }
    // Taken from https://github.com/dimdenGD/YeahTwitter/blob/9e0520f5abe029f57929795d8de0d2e5d3751cf3/us.js#L48
    function parseHeaders(headersString) {
        const headers = new Headers();
        const lines = headersString.trim().split(/[\r\n]+/);
        lines.forEach(line => {
            const parts = line.split(':');
            const header = parts.shift();
            const value = parts.join(':');
            headers.append(header, value);
        });
        return headers;
    }
    var serverLikesThisBrowser = false;
    var serverHatesThisBrowser = false;
    async function handleWorkerFetchRequest(fetchRequest) {
        const startTime = performance.now();
        
        try {
            // Enhanced error handling with retry logic
            const maxRetries = 3;
            let lastError = null;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    if (serverLikesThisBrowser || !serverHatesThisBrowser) {
                        const response = await unsafeWindow.realFetch(fetchRequest.url, fetchRequest.options);
                        const responseBody = await response.text();
                        
                        const responseObject = {
                            id: fetchRequest.id,
                            status: response.status,
                            statusText: response.statusText,
                            headers: Object.fromEntries(response.headers.entries()),
                            body: responseBody
                        };
                        
                        if (responseObject.status === 200) {
                            try {
                                const resp = JSON.parse(responseBody);
                                if (typeof resp.errors !== 'undefined') {
                                    serverHatesThisBrowser = true;
                                    if (OPT_DEBUG_MODE) {
                                        console.warn(`[${SCRIPT_NAME}] Server rejected request:`, resp.errors);
                                    }
                                } else {
                                    serverLikesThisBrowser = true;
                                }
                            } catch (parseError) {
                                if (OPT_DEBUG_MODE) {
                                    console.warn(`[${SCRIPT_NAME}] Failed to parse response:`, parseError);
                                }
                            }
                        }
                        
                        if (serverLikesThisBrowser || !serverHatesThisBrowser) {
                            const duration = performance.now() - startTime;
                            if (OPT_DEBUG_MODE) {
                                console.log(`[${SCRIPT_NAME}] Request completed in ${duration.toFixed(2)}ms`);
                            }
                            return responseObject;
                        }
                    }
                    
                    // Fallback to GM.xmlHttpRequest if available
                    if (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest !== 'undefined') {
                        const enhancedHeaders = {
                            ...fetchRequest.options.headers,
                            'Sec-Ch-Ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
                            'Referer': 'https://www.twitch.tv/',
                            'Origin': 'https://www.twitch.tv/',
                            'Host': 'gql.twitch.tv'
                        };
                        
                        const response = await makeGmXmlHttpRequest({
                            ...fetchRequest,
                            options: {
                                ...fetchRequest.options,
                                headers: enhancedHeaders
                            }
                        });
                        
                        const responseObject = {
                            id: fetchRequest.id,
                            status: response.status,
                            statusText: response.statusText,
                            headers: Object.fromEntries(parseHeaders(response.responseHeaders).entries()),
                            body: response.responseText
                        };
                        
                        const duration = performance.now() - startTime;
                        if (OPT_DEBUG_MODE) {
                            console.log(`[${SCRIPT_NAME}] GM request completed in ${duration.toFixed(2)}ms`);
                        }
                        return responseObject;
                    }
                    
                    throw new Error('No valid request method available');
                    
                } catch (error) {
                    lastError = error;
                    if (OPT_DEBUG_MODE) {
                        console.warn(`[${SCRIPT_NAME}] Request attempt ${attempt + 1} failed:`, error.message);
                    }
                    
                    // Wait before retry (exponential backoff)
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
                    }
                }
            }
            
            throw lastError || new Error('All request attempts failed');
            
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`[${SCRIPT_NAME}] Request failed after ${duration.toFixed(2)}ms:`, error);
            
            return {
                id: fetchRequest.id,
                error: error.message || 'Unknown error occurred'
            };
        }
    }
    function hookFetch() {
        var realFetch = unsafeWindow.fetch;
        unsafeWindow.realFetch = realFetch;
        unsafeWindow.fetch = function(url, init, ...args) {
            if (typeof url === 'string') {
                if (url.includes('gql')) {
                    var deviceId = init.headers['X-Device-Id'];
                    if (typeof deviceId !== 'string') {
                        deviceId = init.headers['Device-ID'];
                    }
                    if (typeof deviceId === 'string') {
                        gql_device_id = deviceId;
                    }
                    if (gql_device_id) {
                        postTwitchWorkerMessage('UboUpdateDeviceId', gql_device_id);
                    }
                    if (typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                        if (OPT_ACCESS_TOKEN_PLAYER_TYPE) {
                            const newBody = JSON.parse(init.body);
                            if (Array.isArray(newBody)) {
                                for (let i = 0; i < newBody.length; i++) {
                                    newBody[i].variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
                                }
                            } else {
                                newBody.variables.playerType = OPT_ACCESS_TOKEN_PLAYER_TYPE;
                            }
                            init.body = JSON.stringify(newBody);
                        }
                        if (typeof init.headers['Client-Integrity'] === 'string') {
                            ClientIntegrityHeader = init.headers['Client-Integrity'];
                            if (ClientIntegrityHeader) {
                                postTwitchWorkerMessage('UpdateClientIntegrityHeader', init.headers['Client-Integrity']);
                            }
                        }
                        if (typeof init.headers['Authorization'] === 'string') {
                            AuthorizationHeader = init.headers['Authorization'];
                            if (AuthorizationHeader) {
                                postTwitchWorkerMessage('UpdateAuthorizationHeader', init.headers['Authorization']);
                            }
                        }
                    }
                }
            }
            return realFetch.apply(this, arguments);
        };
    }
    function reloadTwitchPlayer(isSeek, isPausePlay) {
        // Taken from ttv-tools / ffz
        // https://github.com/Nerixyz/ttv-tools/blob/master/src/context/twitch-player.ts
        // https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/sites/twitch-twilight/modules/player.jsx
        function findReactNode(root, constraint) {
            if (root.stateNode && constraint(root.stateNode)) {
                return root.stateNode;
            }
            let node = root.child;
            while (node) {
                const result = findReactNode(node, constraint);
                if (result) {
                    return result;
                }
                node = node.sibling;
            }
            return null;
        }
        function findReactRootNode() {
            var reactRootNode = null;
            var rootNode = document.querySelector('#root');
            if (rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current) {
                reactRootNode = rootNode._reactRootContainer._internalRoot.current;
            }
            if (reactRootNode == null) {
                var containerName = Object.keys(rootNode).find(x => x.startsWith('__reactContainer'));
                if (containerName != null) {
                    reactRootNode = rootNode[containerName];
                }
            }
            return reactRootNode;
        }
        var reactRootNode = findReactRootNode();
        if (!reactRootNode) {
            console.log('Could not find react root');
            return;
        }
        var player = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
        player = player && player.props && player.props.mediaPlayerInstance ? player.props.mediaPlayerInstance : null;
        var playerState = findReactNode(reactRootNode, node => node.setSrc && node.setInitialPlaybackSettings);
        if (!player) {
            console.log('Could not find player');
            return;
        }
        if (!playerState) {
            console.log('Could not find player state');
            return;
        }
        if (player.paused || player.core?.paused) {
            return;
        }
        if (isSeek) {
            console.log('Force seek to reset player (hopefully fixing any audio desync) pos:' + player.getPosition() + ' range:' + JSON.stringify(player.getBuffered()));
            var pos = player.getPosition();
            player.seekTo(0);
            player.seekTo(pos);
            return;
        }
        if (isPausePlay) {
            player.pause();
            player.play();
            return;
        }
        const lsKeyQuality = 'video-quality';
        const lsKeyMuted = 'video-muted';
        const lsKeyVolume = 'volume';
        var currentQualityLS = localStorage.getItem(lsKeyQuality);
        var currentMutedLS = localStorage.getItem(lsKeyMuted);
        var currentVolumeLS = localStorage.getItem(lsKeyVolume);
        if (player?.core?.state) {
            localStorage.setItem(lsKeyMuted, JSON.stringify({default:player.core.state.muted}));
            localStorage.setItem(lsKeyVolume, player.core.state.volume);
        }
        if (player?.core?.state?.quality?.group) {
            localStorage.setItem(lsKeyQuality, JSON.stringify({default:player.core.state.quality.group}));
        }
        playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
        setTimeout(() => {
            localStorage.setItem(lsKeyQuality, currentQualityLS);
            localStorage.setItem(lsKeyMuted, currentMutedLS);
            localStorage.setItem(lsKeyVolume, currentVolumeLS);
        }, 3000);
    }
    function onContentLoaded() {
        console.log(`[${SCRIPT_NAME}] Initializing enhanced features...`);
        
        // Enhanced visibility handling
        setupVisibilityHandling();
        
        // Enhanced localStorage management
        setupLocalStorageHooks();
        
        // Add statistics display
        if (OPT_ENHANCED_UI) {
            addStatisticsDisplay();
        }
        
        // Add settings panel
        if (OPT_ENHANCED_UI) {
            addSettingsPanel();
        }
        
        console.log(`[${SCRIPT_NAME}] Enhanced features initialized`);
    }
    
    function setupVisibilityHandling() {
        try {
            Object.defineProperty(document, 'visibilityState', {
                get() { return 'visible'; }
            });
        } catch {}
        
        const hidden = document.__lookupGetter__('hidden');
        const webkitHidden = document.__lookupGetter__('webkitHidden');
        
        try {
            Object.defineProperty(document, 'hidden', {
                get() { return false; }
            });
        } catch {}
        
        const block = e => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        
        let wasVideoPlaying = true;
        const visibilityChange = e => {
            if (typeof chrome !== 'undefined') {
                const videos = document.getElementsByTagName('video');
                if (videos.length > 0) {
                    if (hidden.apply(document) === true || (webkitHidden && webkitHidden.apply(document) === true)) {
                        wasVideoPlaying = !videos[0].paused && !videos[0].ended;
                    } else if (wasVideoPlaying && !videos[0].ended) {
                        videos[0].play();
                    }
                }
            }
            block(e);
        };
        
        document.addEventListener('visibilitychange', visibilityChange, true);
        document.addEventListener('webkitvisibilitychange', visibilityChange, true);
        document.addEventListener('mozvisibilitychange', visibilityChange, true);
        document.addEventListener('hasFocus', block, true);
        
        try {
            if (/Firefox/.test(navigator.userAgent)) {
                Object.defineProperty(document, 'mozHidden', {
                    get() { return false; }
                });
            } else {
                Object.defineProperty(document, 'webkitHidden', {
                    get() { return false; }
                });
            }
        } catch {}
    }
    
    function setupLocalStorageHooks() {
        const keysToCache = [
            'video-quality',
            'video-muted',
            'volume',
            'lowLatencyModeEnabled',
            'persistenceEnabled',
        ];
        
        const cachedValues = new Map();
        keysToCache.forEach(key => {
            cachedValues.set(key, localStorage.getItem(key));
        });
        
        const realSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            if (cachedValues.has(key)) {
                cachedValues.set(key, value);
            }
            realSetItem.apply(this, arguments);
        };
        
        const realGetItem = localStorage.getItem;
        localStorage.getItem = function(key) {
            if (cachedValues.has(key)) {
                return cachedValues.get(key);
            }
            return realGetItem.apply(this, arguments);
        };
    }
    
    function addStatisticsDisplay() {
        const statsContainer = document.createElement('div');
        statsContainer.id = 'enhanced-ad-blocker-stats';
        statsContainer.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            z-index: 10000;
            display: none;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        const statsContent = document.createElement('div');
        statsContent.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🛡️ Ad Blocker Stats</div>
            <div>Ads Blocked: <span id="ads-blocked-count">0</span></div>
            <div>Streams Processed: <span id="streams-processed-count">0</span></div>
            <div>Uptime: <span id="uptime">0s</span></div>
        `;
        
        statsContainer.appendChild(statsContent);
        document.body.appendChild(statsContainer);
        
        // Update stats every second
        setInterval(updateStatistics, 1000);
    }
    
    function updateStatistics() {
        const adsBlockedEl = document.getElementById('ads-blocked-count');
        const streamsProcessedEl = document.getElementById('streams-processed-count');
        const uptimeEl = document.getElementById('uptime');
        
        if (adsBlockedEl) {
            adsBlockedEl.textContent = performanceStats.adsBlocked;
        }
        if (streamsProcessedEl) {
            streamsProcessedEl.textContent = performanceStats.streamsProcessed;
        }
        if (uptimeEl) {
            const uptime = Math.floor((Date.now() - performanceStats.startTime) / 1000);
            uptimeEl.textContent = `${uptime}s`;
        }
    }
    
    function addSettingsPanel() {
        const settingsButton = document.createElement('button');
        settingsButton.innerHTML = '⚙️';
        settingsButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            z-index: 10000;
            font-size: 16px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        settingsButton.addEventListener('click', toggleSettingsPanel);
        document.body.appendChild(settingsButton);
    }
    
    function toggleSettingsPanel() {
        let panel = document.getElementById('enhanced-ad-blocker-settings');
        if (panel) {
            panel.remove();
            return;
        }
        
        panel = document.createElement('div');
        panel.id = 'enhanced-ad-blocker-settings';
        panel.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 12px;
            z-index: 10000;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            min-width: 250px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        panel.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 16px;">🛡️ Ad Blocker Settings</div>
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="show-banner" ${OPT_SHOW_AD_BANNER ? 'checked' : ''} style="margin-right: 8px;">
                    Show Ad Blocking Notifications
                </label>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="debug-mode" ${OPT_DEBUG_MODE ? 'checked' : ''} style="margin-right: 8px;">
                    Debug Mode
                </label>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="performance-mode" ${OPT_PERFORMANCE_MODE ? 'checked' : ''} style="margin-right: 8px;">
                    Performance Mode
                </label>
            </div>
            <button id="show-stats" style="
                background: linear-gradient(135deg, #9146ff, #00d4aa);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                width: 100%;
            ">Show Statistics</button>
        `;
        
        // Add event listeners
        panel.querySelector('#show-banner').addEventListener('change', (e) => {
            OPT_SHOW_AD_BANNER = e.target.checked;
        });
        
        panel.querySelector('#debug-mode').addEventListener('change', (e) => {
            OPT_DEBUG_MODE = e.target.checked;
        });
        
        panel.querySelector('#performance-mode').addEventListener('change', (e) => {
            OPT_PERFORMANCE_MODE = e.target.checked;
        });
        
        panel.querySelector('#show-stats').addEventListener('click', () => {
            const statsEl = document.getElementById('enhanced-ad-blocker-stats');
            if (statsEl) {
                statsEl.style.display = statsEl.style.display === 'none' ? 'block' : 'none';
            }
        });
        
        document.body.appendChild(panel);
    }
    unsafeWindow.reloadTwitchPlayer = reloadTwitchPlayer;
    declareOptions(unsafeWindow);
    hookWindowWorker();
    hookFetch();
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        unsafeWindow.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
})();
