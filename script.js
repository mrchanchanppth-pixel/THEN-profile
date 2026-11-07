const audioFiles = [
            'Sound/黑暗海滩.mp3',
            'Sound/Worry.mp3',
            'Sound/天竺旧梦.mp3',
            'Sound/室内系的.mp3',
            'Sound/最初的记忆.mp3'
        ];
        const fallbackCover = 'Photo/Sadmes.jpg';
        const playlist = audioFiles.map((file) => {
            const title = file.replace(/\.[^.]+$/, '').replace(/^Sound\//, '');

            return {
                title,
                file: encodeURIComponent(file),
                cover: encodeURIComponent(`Photo/${title}.jpeg`)
            };
        });

        const audio = new Audio();
        audio.preload = 'metadata';
        audio.loop = false;

        const profileContent = document.getElementById('profileContent');
        const menuButton = document.getElementById('menuButton');
        const drawerBackdrop = document.getElementById('drawerBackdrop');
        const sideDrawer = document.getElementById('sideDrawer');
        const drawerClose = document.getElementById('drawerClose');
        const drawerLinks = sideDrawer ? sideDrawer.querySelectorAll('a') : [];
        const playBtn = document.getElementById('playBtn');
        const playIcon = document.getElementById('playIcon');
        const muteBtn = document.getElementById('muteBtn');
        const volumeIcon = document.getElementById('volumeIcon');
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        if (volumeSlider) {
            audio.volume = Number(volumeSlider.value);
        }
        const previousBtn = document.getElementById('previousBtn');
        const nextBtn = document.getElementById('nextBtn');
        const progressFill = document.getElementById('progressFill');
        const progressBar = progressFill ? progressFill.parentElement : null;
        const currentTimeDisplay = document.getElementById('currentTime');
        const totalTimeDisplay = document.getElementById('totalTime');
        const trackTitle = document.getElementById('trackTitle');
        const trackCover = document.getElementById('trackCover');
        let currentTrackIndex = Math.floor(Math.random() * playlist.length);
        let coverLoadToken = 0;
        let previousVolume = volumeSlider ? Number(volumeSlider.value) : 0.7;
        let activeVideo = document.getElementById('backgroundVideo');
        let standbyVideo = document.getElementById('nextBackgroundVideo');

        const backgroundVideos = ['background/1.mp4', 'background/2.mp4', 'background/3.mp4', 'background/4.mp4', 'background/5.mp4'];
        const crossfadeDuration = 1250;
        const backgroundVideoFailuresBeforeStop = backgroundVideos.length;
        let videoQueue = [];
        let lastVideoIndex = -1;
        let standbyReady = false;
        let activeVideoFailed = false;
        let isTransitioning = false;
        let standbyRequestId = 0;
        let standbyCanPlayHandler;
        let standbyErrorHandler;
        let consecutiveVideoFailures = 0;
        let consecutivePlaybackFailures = 0;
        let isDrawerOpen = false;

        const setDrawerOpen = (open) => {
            if (!sideDrawer || !drawerBackdrop || !menuButton) return;
            isDrawerOpen = open;
            sideDrawer.classList.toggle('is-open', open);
            drawerBackdrop.classList.toggle('is-open', open);
            menuButton.setAttribute('aria-expanded', String(open));
            menuButton.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
            sideDrawer.setAttribute('aria-hidden', String(!open));
            sideDrawer.inert = !open;
            drawerBackdrop.setAttribute('aria-hidden', String(!open));
            document.body.style.overflow = open ? 'hidden' : '';

            if (open) {
                if (drawerClose) drawerClose.focus();
            } else {
                menuButton.focus();
            }
        };

        const routePages = new Map();
        if (profileContent) routePages.set('profileContent', profileContent);
        const faqSection = document.getElementById('faq');
        if (faqSection) routePages.set('faq', faqSection);

        const desktopNav = document.querySelector('.desktop-nav');
        const desktopNavIndicator = document.getElementById('desktopNavIndicator');
        const desktopNavLinks = Array.from(document.querySelectorAll('.desktop-nav-link'));
        const drawerNavLinks = Array.from(document.querySelectorAll('.drawer-link'));

        const updateNavIndicators = (activeRouteKey) => {
            let activeDesktopLink = null;
            const isWebsitePage = window.location.pathname.endsWith('website.html') || window.location.href.includes('website.html');

            desktopNavLinks.forEach((link) => {
                const href = link.getAttribute('href') || '';
                const route = link.dataset.route || (href.startsWith('#') ? href.slice(1) : '');
                const isCurrentWebsite = isWebsitePage && (href === 'website.html' || href.endsWith('/website.html'));
                const isActive = isCurrentWebsite || (route && route === activeRouteKey);

                link.classList.toggle('is-active', isActive);
                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                    activeDesktopLink = link;
                } else {
                    link.removeAttribute('aria-current');
                }
            });

            if (desktopNav && desktopNavIndicator && activeDesktopLink) {
                const linkRect = activeDesktopLink.getBoundingClientRect();
                const navRect = desktopNav.getBoundingClientRect();
                const left = linkRect.left - navRect.left;
                const width = linkRect.width;
                desktopNavIndicator.style.transform = `translate3d(${left}px, 0, 0)`;
                desktopNavIndicator.style.width = `${width}px`;
                desktopNavIndicator.style.opacity = '1';
            } else if (desktopNavIndicator) {
                desktopNavIndicator.style.opacity = '0';
            }

            drawerNavLinks.forEach((link) => {
                const href = link.getAttribute('href') || '';
                const route = link.dataset.route || (href.startsWith('#') ? href.slice(1) : '');
                const isCurrentWebsite = isWebsitePage && (href === 'website.html' || href.endsWith('/website.html'));
                const isActive = isCurrentWebsite || (route && route === activeRouteKey);

                link.classList.toggle('is-active', isActive);
                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        };

        const animatePageEntry = (page) => {
            if (!page) return;
            page.classList.remove('page-animate-in');
            void page.offsetWidth;
            page.classList.add('page-animate-in');
        };

        const showCurrentRoute = (moveFocus = false) => {
            if (routePages.size === 0) {
                updateNavIndicators();
                return;
            }
            const requestedRoute = window.location.hash.slice(1);
            const defaultRoute = routePages.has('profileContent') ? 'profileContent' : routePages.keys().next().value;
            const activeRouteKey = routePages.has(requestedRoute) ? requestedRoute : defaultRoute;
            const activePage = routePages.get(activeRouteKey);

            routePages.forEach((page) => {
                if (page) page.classList.toggle('is-active', page === activePage);
            });

            updateNavIndicators(activeRouteKey);
            if (activePage) {
                animatePageEntry(activePage);
                if (moveFocus) activePage.focus({ preventScroll: true });
            }
        };

        window.addEventListener('hashchange', () => showCurrentRoute(true));
        showCurrentRoute();

        // Keep indicator aligned on window resize
        window.addEventListener('resize', () => {
            const requestedRoute = window.location.hash.slice(1);
            const defaultRoute = routePages.has('profileContent') ? 'profileContent' : routePages.keys().next().value;
            const activeRouteKey = routePages.has(requestedRoute) ? requestedRoute : defaultRoute;
            updateNavIndicators(activeRouteKey);
        });

        document.querySelectorAll('.desktop-nav-link, .drawer-link').forEach((link) => {
            link.addEventListener('click', () => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const targetPage = routePages.get(href.slice(1));
                    if (targetPage?.classList.contains('is-active')) {
                        animatePageEntry(targetPage);
                    }
                }
            });
        });

        const faqTabs = Array.from(document.querySelectorAll('[data-faq-tab]'));
        const activateFaqTab = (activeTab, moveFocus = false) => {
            faqTabs.forEach((tab) => {
                const isActive = tab === activeTab;
                const panel = document.getElementById(tab.dataset.faqTab);

                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
                tab.tabIndex = isActive ? 0 : -1;
                panel.hidden = !isActive;
            });

            if (moveFocus) activeTab.focus();
        };

        faqTabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activateFaqTab(tab));
            tab.addEventListener('keydown', (event) => {
                let nextIndex;
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                    nextIndex = (index + 1) % faqTabs.length;
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                    nextIndex = (index - 1 + faqTabs.length) % faqTabs.length;
                } else if (event.key === 'Home') {
                    nextIndex = 0;
                } else if (event.key === 'End') {
                    nextIndex = faqTabs.length - 1;
                } else {
                    return;
                }

                event.preventDefault();
                activateFaqTab(faqTabs[nextIndex], true);
            });
        });

        const getRandomVideoIndex = () => {
            if (videoQueue.length === 0) {
                videoQueue = backgroundVideos.map((_, index) => index);
                for (let index = videoQueue.length - 1; index > 0; index--) {
                    const swapIndex = Math.floor(Math.random() * (index + 1));
                    [videoQueue[index], videoQueue[swapIndex]] = [videoQueue[swapIndex], videoQueue[index]];
                }
                if (videoQueue.length > 1 && videoQueue[0] === lastVideoIndex) {
                    [videoQueue[0], videoQueue[1]] = [videoQueue[1], videoQueue[0]];
                }
            }

            lastVideoIndex = videoQueue.shift();
            return lastVideoIndex;
        };

        const clearStandbyListeners = () => {
            if (standbyCanPlayHandler) {
                standbyVideo.removeEventListener('canplay', standbyCanPlayHandler);
                standbyCanPlayHandler = undefined;
            }
            if (standbyErrorHandler) {
                standbyVideo.removeEventListener('error', standbyErrorHandler);
                standbyErrorHandler = undefined;
            }
        };

        const prepareStandbyVideo = () => {
            standbyReady = false;
            clearStandbyListeners();
            standbyVideo.pause();
            standbyVideo.classList.remove('is-active');
            standbyVideo.preload = 'auto';
            standbyVideo.src = backgroundVideos[getRandomVideoIndex()];
            standbyVideo.loop = false;

            const requestId = ++standbyRequestId;
            const videoToPrepare = standbyVideo;
            standbyCanPlayHandler = () => {
                if (requestId !== standbyRequestId || videoToPrepare !== standbyVideo) return;
                clearStandbyListeners();
                standbyReady = true;
                consecutiveVideoFailures = 0;
                if (activeVideo.ended || activeVideoFailed) transitionBackgroundVideo(true);
            };
            standbyErrorHandler = () => {
                if (requestId !== standbyRequestId || videoToPrepare !== standbyVideo) return;
                clearStandbyListeners();
                consecutiveVideoFailures += 1;
                console.warn(`Unable to load background video: ${videoToPrepare.currentSrc || videoToPrepare.src}`);
                if (consecutiveVideoFailures >= backgroundVideoFailuresBeforeStop) {
                    console.error('Background playlist stopped after repeated video load failures.');
                    return;
                }
                prepareStandbyVideo();
            };
            standbyVideo.addEventListener('canplay', standbyCanPlayHandler, { once: true });
            standbyVideo.addEventListener('error', standbyErrorHandler, { once: true });
            standbyVideo.load();
            if (standbyVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                standbyCanPlayHandler();
            }
        };

        const transitionBackgroundVideo = async (force = false) => {
            if (isTransitioning || !standbyReady) return;
            if (!force && (!Number.isFinite(activeVideo.duration) ||
                activeVideo.duration - activeVideo.currentTime > crossfadeDuration / 1000)) return;

            isTransitioning = true;
            const incomingVideo = standbyVideo;
            const outgoingVideo = activeVideo;
            incomingVideo.currentTime = 0;
            try {
                await incomingVideo.play();
            } catch (error) {
                console.warn(`Unable to start background video: ${incomingVideo.currentSrc || incomingVideo.src}`, error);
                isTransitioning = false;
                consecutivePlaybackFailures += 1;
                if (consecutivePlaybackFailures >= backgroundVideoFailuresBeforeStop) {
                    console.error('Background playlist stopped after repeated playback failures.');
                } else {
                    prepareStandbyVideo();
                }
                return;
            }

            consecutivePlaybackFailures = 0;
            outgoingVideo.classList.remove('is-active');
            incomingVideo.classList.add('is-active');
            activeVideo = incomingVideo;
            standbyVideo = outgoingVideo;
            activeVideoFailed = false;
            standbyReady = false;

            window.setTimeout(() => {
                standbyVideo.pause();
                standbyVideo.currentTime = 0;
                isTransitioning = false;
                prepareStandbyVideo();
            }, crossfadeDuration);
        };

        const handleVideoTimeUpdate = (event) => {
            if (event.currentTarget === activeVideo) transitionBackgroundVideo();
        };

        const handleVideoEnded = (event) => {
            if (event.currentTarget === activeVideo) transitionBackgroundVideo(true);
        };

        const markActiveVideoFailed = (failedVideo, error) => {
            if (failedVideo !== activeVideo || activeVideoFailed) return;
            activeVideoFailed = true;
            console.warn(`Unable to play background video: ${failedVideo.currentSrc || failedVideo.src}`, error);
            if (standbyReady) transitionBackgroundVideo(true);
        };

        const handleVideoError = (event) => {
            const failedVideo = event.currentTarget;
            if (failedVideo === activeVideo) {
                markActiveVideoFailed(failedVideo, failedVideo.error);
            } else if (!isTransitioning && failedVideo === standbyVideo && standbyReady) {
                standbyReady = false;
                prepareStandbyVideo();
            }
        };

        [activeVideo, standbyVideo].forEach((video) => {
            video.addEventListener('timeupdate', handleVideoTimeUpdate);
            video.addEventListener('ended', handleVideoEnded);
            video.addEventListener('error', handleVideoError);
        });

        const startBackgroundPlaylist = async () => {
            activeVideo.preload = 'auto';
            activeVideo.src = backgroundVideos[getRandomVideoIndex()];
            activeVideo.loop = false;
            activeVideo.load();
            prepareStandbyVideo();
            try {
                await activeVideo.play();
            } catch (error) {
                markActiveVideoFailed(activeVideo, error);
            }
        };

        const formatTime = (seconds) => {
            if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        };

        const updateTrackDisplay = () => {
            if (!trackTitle || !trackCover) return;
            const currentTrack = playlist[currentTrackIndex];
            const token = ++coverLoadToken;
            trackTitle.textContent = currentTrack.title;
            trackCover.alt = `${currentTrack.title} cover`;
            trackCover.style.opacity = '0';
            trackCover.onerror = () => {
                if (token !== coverLoadToken) return;
                trackCover.onerror = null;
                if (trackCover.src.endsWith(fallbackCover)) {
                    console.error(`Unable to load the fallback music cover: ${fallbackCover}`);
                    trackCover.style.opacity = '1';
                    return;
                }
                trackCover.src = fallbackCover;
            };
            trackCover.onload = () => {
                if (token !== coverLoadToken) return;
                trackCover.style.opacity = '1';
            };
            trackCover.src = currentTrack.cover;
            if (trackCover.complete && trackCover.naturalWidth > 0) {
                trackCover.style.opacity = '1';
            }
            updateProgress();
        };

        const changeTrack = (nextIndex, autoplay = true) => {
            if (playlist.length === 0) {
                console.error('Cannot change tracks because the music playlist is empty.');
                return;
            }
            currentTrackIndex = (nextIndex + playlist.length) % playlist.length;
            const currentTrack = playlist[currentTrackIndex];
            audio.pause();
            audio.src = currentTrack.file;
            audio.load();
            updateTrackDisplay();
            updatePlayButton();
            if (autoplay) startPlayback();
        };

        const updateProgress = () => {
            if (!progressFill || !progressBar || !currentTimeDisplay || !totalTimeDisplay) return;
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
            const percentage = duration > 0 ? Math.min((current / duration) * 100, 100) : 0;
            progressFill.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', String(Math.round(percentage)));
            currentTimeDisplay.textContent = formatTime(current);
            totalTimeDisplay.textContent = formatTime(duration);
        };

        const updatePlayButton = () => {
            if (!playIcon || !playBtn) return;
            const isPlaying = !audio.paused;
            playIcon.classList.toggle('fa-play', !isPlaying);
            playIcon.classList.toggle('fa-pause', isPlaying);
            playBtn.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
            playBtn.setAttribute('aria-pressed', String(isPlaying));
        };

        const updateVolumeControls = () => {
            if (!volumeSlider || !volumeValue || !muteBtn || !volumeIcon) return;
            const volume = audio.muted ? 0 : audio.volume;
            const isMuted = audio.muted || volume === 0;
            volumeSlider.value = String(volume);
            volumeValue.textContent = `${Math.round(volume * 100)}%`;
            muteBtn.setAttribute('aria-label', isMuted ? 'Unmute music' : 'Mute music');
            muteBtn.setAttribute('aria-pressed', String(isMuted));
            volumeIcon.classList.toggle('fa-volume-xmark', isMuted);
            volumeIcon.classList.toggle('fa-volume-low', !isMuted && volume < 0.5);
            volumeIcon.classList.toggle('fa-volume-high', !isMuted && volume >= 0.5);
        };

        const startPlayback = async () => {
            if (!audio.paused) return;
            try {
                await audio.play();
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    updatePlayButton();
                    return;
                }
                if (error.name !== 'AbortError') {
                    console.warn('Unable to autoplay music; playback may require a user gesture.', error);
                }
                updatePlayButton();
            }
        };

        const stopPlayback = () => {
            audio.pause();
        };

        audio.addEventListener('loadedmetadata', updateProgress);
        audio.addEventListener('durationchange', updateProgress);
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('play', updatePlayButton);
        audio.addEventListener('pause', updatePlayButton);
        audio.addEventListener('volumechange', updateVolumeControls);
        audio.addEventListener('ended', () => changeTrack(currentTrackIndex + 1));
        audio.addEventListener('error', () => {
            console.error(`Unable to load the music track: ${audio.currentSrc || audio.src}`, audio.error);
            updatePlayButton();
        });

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (audio.paused) {
                    startPlayback();
                } else {
                    stopPlayback();
                }
            });
        }
        if (previousBtn) previousBtn.addEventListener('click', () => changeTrack(currentTrackIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => changeTrack(currentTrackIndex + 1));

        if (playBtn) {
            changeTrack(currentTrackIndex, false);
            updateVolumeControls();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => void startPlayback(), { once: true });
            } else {
                void startPlayback();
            }

            const handlePlaybackGesture = () => {
                if (!audio.paused) {
                    document.removeEventListener('click', handlePlaybackGesture);
                    return;
                }
                void startPlayback();
            };
            document.addEventListener('click', handlePlaybackGesture);
        }
        void startBackgroundPlaylist();

        if (volumeSlider) {
            volumeSlider.addEventListener('input', () => {
                const volume = Number(volumeSlider.value);
                audio.volume = volume;
                audio.muted = volume === 0;
                if (volume > 0) previousVolume = volume;
            });
        }
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                if (audio.muted || audio.volume === 0) {
                    audio.volume = previousVolume || 0.7;
                    audio.muted = false;
                } else {
                    previousVolume = audio.volume;
                    audio.muted = true;
                }
                updateVolumeControls();
            });
        }

        if (menuButton) menuButton.addEventListener('click', () => setDrawerOpen(!isDrawerOpen));
        if (drawerClose) drawerClose.addEventListener('click', () => setDrawerOpen(false));
        if (drawerBackdrop) drawerBackdrop.addEventListener('click', () => setDrawerOpen(false));
        drawerLinks.forEach((link) => link.addEventListener('click', () => setDrawerOpen(false)));

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isDrawerOpen) {
                setDrawerOpen(false);
            }
        });
