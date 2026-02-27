/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  Bell, 
  Home, 
  Tv, 
  PlayCircle, 
  X, 
  Info, 
  Mail, 
  ShieldAlert, 
  Users, 
  Send,
  ExternalLink,
  ChevronRight,
  Flame,
  ListMusic,
  Search,
  RefreshCw,
  Globe,
  Music as MusicIcon,
  Trophy,
  Film,
  Newspaper,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import moment from 'moment';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

import { 
  subscribeToSettings, 
  subscribeToBanners, 
  subscribeToMatches, 
  subscribeToChannels, 
  subscribeToHighlights, 
  subscribeToCategories, 
  setupOnlineCounter 
} from './services/firebase';
import { AppSettings, Banners, Category, Channel, Highlight, Match, Server } from './types';

type Tab = 'home' | 'channels' | 'highlights' | 'playlist' | 'about' | 'contact' | 'copyright';

const AdScript = () => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adRef.current && !adRef.current.firstChild) {
      const config = document.createElement('script');
      config.type = 'text/javascript';
      config.innerHTML = `
        atOptions = {
          'key' : 'cc049afd2f30424fd0d67afd2d41324e',
          'format' : 'iframe',
          'height' : 50,
          'width' : 320,
          'params' : {}
        };
      `;
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://www.highperformanceformat.com/cc049afd2f30424fd0d67afd2d41324e/invoke.js';
      
      adRef.current.appendChild(config);
      adRef.current.appendChild(script);
    }
  }, []);

  return <div ref={adRef} className="flex justify-center mb-6 min-h-[50px]" />;
};

const FooterAdScript = () => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adRef.current && !adRef.current.firstChild) {
      const config = document.createElement('script');
      config.type = 'text/javascript';
      config.innerHTML = `
        atOptions = {
          'key' : '8a13a780322fcc0c52378079ccb655e6',
          'format' : 'iframe',
          'height' : 90,
          'width' : 728,
          'params' : {}
        };
      `;
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://www.highperformanceformat.com/8a13a780322fcc0c52378079ccb655e6/invoke.js';
      
      adRef.current.appendChild(config);
      adRef.current.appendChild(script);
    }
  }, []);

  return <div ref={adRef} className="flex justify-center mb-6 min-h-[90px]" />;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [banners, setBanners] = useState<Banners | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [channelCategories, setChannelCategories] = useState<Category[]>([]);
  const [highlightCategories, setHighlightCategories] = useState<Category[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(moment());
  
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  const [selectedMatchServers, setSelectedMatchServers] = useState<Server[] | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [activeServerIndex, setActiveServerIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Filters
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'recent'>('all');
  const [channelFilter, setChannelFilter] = useState('All');
  const [highlightFilter, setHighlightFilter] = useState('All');

  // Search State
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [highlightSearchQuery, setHighlightSearchQuery] = useState('');

  // Playlist State
  const [playlistChannels, setPlaylistChannels] = useState<{ [key: string]: any[] }>({});
  const [currentPlaylistUrl, setCurrentPlaylistUrl] = useState<string | null>(null);
  const [playlistFilter, setPlaylistFilter] = useState('All');
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false);

  const featuredPlaylists = [
    { name: 'Bangladesh', url: 'https://iptv-org.github.io/iptv/countries/bd.m3u', icon: Globe },
    { name: 'India', url: 'https://iptv-org.github.io/iptv/countries/in.m3u', icon: Globe },
    { name: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', icon: Trophy },
    { name: 'Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u', icon: MusicIcon },
    { name: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', icon: Film },
    { name: 'News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', icon: Newspaper },
  ];

  const getAttribute = (line: string, attributeName: string) => {
    const regex = new RegExp(`${attributeName}="([^"]*)"`, 'i');
    const match = line.match(regex);
    return match ? match[1] : '';
  };

  const parseM3U = (m3uText: string) => {
    const lines = m3uText.split('\n');
    const groupedChannels: { [key: string]: any[] } = {};
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF')) {
        const infoLine = line;
        let streamUrl = '';
        // Look for the next non-empty, non-comment line which should be the URL
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine && !nextLine.startsWith('#')) {
            streamUrl = nextLine;
            i = j; // Skip to this line for the next iteration
            break;
          }
        }
        
        if (infoLine && streamUrl) {
          const logo = getAttribute(infoLine, 'tvg-logo');
          let group = getAttribute(infoLine, 'group-title') || 'All Channels';
          const namePart = infoLine.split(',').pop();
          const name = namePart ? namePart.trim() : 'Unknown Channel';
          const channelInfo = { logo, group, name, url: streamUrl };
          if (!groupedChannels[channelInfo.group]) {
            groupedChannels[channelInfo.group] = [];
          }
          groupedChannels[channelInfo.group].push(channelInfo);
        }
      }
    }
    return groupedChannels;
  };

  const loadPlaylist = async (url: string) => {
    setIsPlaylistLoading(true);
    setCurrentPlaylistUrl(url);
    
    const proxies = [
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      (u: string) => u // Direct fetch as last resort
    ];

    let lastError = null;
    for (const getProxyUrl of proxies) {
      try {
        const targetUrl = getProxyUrl(url);
        const response = await fetch(targetUrl);
        if (!response.ok) continue;
        
        const m3uText = await response.text();
        const grouped = parseM3U(m3uText);
        
        if (Object.keys(grouped).length > 0) {
          setPlaylistChannels(grouped);
          setPlaylistFilter('All');
          setIsPlaylistLoading(false);
          return; // Success!
        }
      } catch (error) {
        lastError = error;
        console.warn(`Proxy failed for ${url}, trying next...`);
      }
    }

    console.error('All proxies failed to load playlist:', lastError);
    setPlaylistChannels({});
    setIsPlaylistLoading(false);
  };

  useEffect(() => {
    if (settings?.playlists && settings.playlists.length > 0 && !currentPlaylistUrl) {
      loadPlaylist(settings.playlists[0].url);
    }
  }, [settings]);

  useEffect(() => {
    const unsubSettings = subscribeToSettings(setSettings);
    const unsubBanners = subscribeToBanners(setBanners);
    const unsubMatches = subscribeToMatches(setMatches);
    const unsubChannels = subscribeToChannels(setChannels);
    const unsubHighlights = subscribeToHighlights(setHighlights);
    const unsubChannelCats = subscribeToCategories('liveChannelCategories', setChannelCategories);
    const unsubHighlightCats = subscribeToCategories('highlightCategories', setHighlightCategories);
    const unsubOnline = setupOnlineCounter(setOnlineCount);

    const timer = setInterval(() => setCurrentTime(moment()), 1000);

    return () => {
      unsubSettings();
      unsubBanners();
      unsubMatches();
      unsubChannels();
      unsubHighlights();
      unsubChannelCats();
      unsubHighlightCats();
      unsubOnline();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (currentVideoUrl && videoRef.current) {
      if (plyrRef.current) plyrRef.current.destroy();
      if (hlsRef.current) hlsRef.current.destroy();

      const isM3U8 = currentVideoUrl.toLowerCase().endsWith('.m3u8');

      if (isM3U8 && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(currentVideoUrl);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = currentVideoUrl;
      }

      plyrRef.current = new Plyr(videoRef.current, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
      });
    }
  }, [currentVideoUrl]);

  const liveMatches = matches.filter(m => moment().isBetween(moment(m.startTime), moment(m.endTime)));
  const upcomingMatches = matches.filter(m => moment().isBefore(moment(m.startTime)));
  const recentMatches = matches.filter(m => moment().isAfter(moment(m.endTime)));

  const filteredMatches = matches.filter(m => {
    if (matchFilter === 'all') return true;
    if (matchFilter === 'live') return moment().isBetween(moment(m.startTime), moment(m.endTime));
    if (matchFilter === 'upcoming') return moment().isBefore(moment(m.startTime));
    if (matchFilter === 'recent') return moment().isAfter(moment(m.endTime));
    return true;
  });

  const filteredChannels = channels.filter(c => {
    const matchesCategory = channelFilter === 'All' || c.categoryName === channelFilter;
    const matchesSearch = c.name.toLowerCase().includes(channelSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredHighlights = highlights.filter(h => {
    const matchesCategory = highlightFilter === 'All' || h.categoryName === highlightFilter;
    const matchesSearch = h.title.toLowerCase().includes(highlightSearchQuery.toLowerCase()) || 
                         h.description.toLowerCase().includes(highlightSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const openPlayer = (servers: Server[]) => {
    setSelectedMatchServers(servers);
    setCurrentVideoUrl(servers[0].url);
    setActiveServerIndex(0);
  };

  const closePlayer = () => {
    setSelectedMatchServers(null);
    setCurrentVideoUrl(null);
    if (plyrRef.current) plyrRef.current.destroy();
    if (hlsRef.current) hlsRef.current.destroy();
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-bg-main/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setIsSideMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_10px_rgba(230,0,35,0.5)]">
            NIHAT TV
          </h1>
          <div className="w-8 h-5 bg-[#006a4e] rounded-sm border border-white/20 relative flex items-center justify-center overflow-hidden">
            <div className="w-3 h-3 bg-[#f42a41] rounded-full" />
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="p-2 hover:bg-white/5 rounded-lg transition-colors relative">
            <Bell className="w-6 h-6" />
            {liveMatches.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-live-red text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                {liveMatches.length}
              </span>
            )}
          </button>
          
          <AnimatePresence>
            {isNotificationOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-72 glass-card overflow-hidden shadow-2xl"
              >
                <div className="p-3 border-b border-white/10 font-bold text-sm">Live Matches</div>
                <div className="max-h-80 overflow-y-auto">
                  {liveMatches.length > 0 ? (
                    liveMatches.map(match => (
                      <button 
                        key={match.id}
                        onClick={() => {
                          openPlayer(match.servers);
                          setIsNotificationOpen(false);
                        }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-white/5 border-b border-white/5 last:border-0 text-left transition-colors"
                      >
                        <img src={match.team1Logo || undefined} className="w-8 h-8 rounded-full object-contain bg-white p-0.5" alt="" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{match.team1Name} vs {match.team2Name}</div>
                          <div className="text-[10px] text-gray-400 truncate">{match.title}</div>
                        </div>
                        <div className="w-2 h-2 bg-live-red rounded-full animate-pulse" />
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-gray-400">No matches are live right now.</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Update Bar */}
      <div className="fixed top-[61px] left-0 right-0 z-40 bg-gradient-to-r from-primary to-secondary h-8 flex items-center overflow-hidden">
        <div className="bg-black/50 px-3 h-full flex items-center text-[10px] font-bold text-white whitespace-nowrap">
          UPDATE
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap text-xs font-bold text-black py-1">
            {settings?.welcomeMessage || 'Welcome to Nihat TV! Enjoy the best live sports experience.'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mt-28 px-4 max-w-2xl mx-auto">
        {activeTab === 'home' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <button 
                onClick={() => setIsAlertOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg font-bold text-sm shadow-lg shadow-yellow-400/20 animate-pulse"
              >
                <Bell className="w-4 h-4" />
                Alert
              </button>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-black rounded-lg font-bold text-xs shadow-lg shadow-secondary/20">
                <Users className="w-4 h-4" />
                Online: {onlineCount}
              </div>

              <div className="flex items-center gap-3 px-4 py-2 bg-bg-card border border-white/10 rounded-xl shadow-inner">
                <Clock className="w-4 h-4 text-secondary animate-pulse" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-black text-white font-mono tracking-tighter">
                    {currentTime.format('HH:mm:ss')}
                  </span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                    {currentTime.format('DD MMM YYYY')}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Banner - Replaced with Script Ad */}
            <AdScript />

            {/* Match Filters */}
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
              {(['all', 'live', 'upcoming', 'recent'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setMatchFilter(f)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                    matchFilter === f 
                    ? 'bg-gradient-to-r from-primary to-secondary text-black shadow-lg shadow-primary/20' 
                    : 'bg-bg-card border border-white/10 text-gray-400'
                  }`}
                >
                  {f.toUpperCase()}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${matchFilter === f ? 'bg-black/20' : 'bg-white/5'}`}>
                    {f === 'all' ? matches.length : f === 'live' ? liveMatches.length : f === 'upcoming' ? upcomingMatches.length : recentMatches.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Match List */}
            <div className="space-y-4">
              {filteredMatches.map(match => {
                const isLive = moment().isBetween(moment(match.startTime), moment(match.endTime));
                const isUpcoming = moment().isBefore(moment(match.startTime));
                const diff = moment.duration(moment(match.startTime).diff(currentTime));
                
                return (
                  <motion.div
                    layout
                    key={match.id}
                    onClick={() => openPlayer(match.servers)}
                    className={`glass-card p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden ${
                      isLive ? 'border-primary shadow-[0_0_20px_rgba(230,0,35,0.2)]' : ''
                    }`}
                  >
                    {match.isImportant && (
                      <div className="absolute top-0 right-0 bg-gradient-to-br from-orange-500 to-red-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-black flex items-center gap-1">
                        HOT <Flame className="w-3 h-3 fill-white" />
                      </div>
                    )}

                    <div className="text-center mb-4">
                      <span className="inline-block px-2 py-0.5 bg-black rounded text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                        {match.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 flex flex-col items-center text-center">
                        <img src={match.team1Logo || undefined} className="w-12 h-12 rounded-full object-contain bg-white p-1 mb-2 border border-white/10" alt="" />
                        <span className="text-xs font-bold line-clamp-1">{match.team1Name}</span>
                      </div>

                      <div className="flex flex-col items-center justify-center min-w-[80px]">
                        {isLive ? (
                          <div className="live-pulse text-live-red font-black text-sm tracking-widest">LIVE</div>
                        ) : isUpcoming ? (
                          <div className="text-center">
                            <div className="text-sm font-bold text-white">{moment(match.startTime).format('hh:mm A')}</div>
                            <div className="text-[10px] text-secondary font-bold">
                              {diff.asDays() >= 1 ? `${Math.floor(diff.asDays())}d ${diff.hours()}h` : `${diff.hours()}h ${diff.minutes()}m`}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] font-black text-yellow-500">FULL TIME</div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col items-center text-center">
                        <img src={match.team2Logo || undefined} className="w-12 h-12 rounded-full object-contain bg-white p-1 mb-2 border border-white/10" alt="" />
                        <span className="text-xs font-bold line-clamp-1">{match.team2Name}</span>
                      </div>
                    </div>

                    <div className="text-center mt-4">
                      <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-gray-400">
                        {match.categoryName}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'channels' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Featured Playlists Quick Access */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {featuredPlaylists.map((pl, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    loadPlaylist(pl.url);
                    setActiveTab('playlist');
                  }}
                  className="flex flex-col items-center justify-center p-3 glass-card hover:border-secondary transition-all gap-1 group"
                >
                  <pl.icon className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold">{pl.name}</span>
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search channels..." 
                value={channelSearchQuery}
                onChange={(e) => setChannelSearchQuery(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-secondary transition-colors"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
              <button
                onClick={() => setChannelFilter('All')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  channelFilter === 'All' ? 'bg-secondary text-black' : 'bg-bg-card border border-white/10 text-gray-400'
                }`}
              >
                ALL
              </button>
              {channelCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setChannelFilter(cat.name)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    channelFilter === cat.name ? 'bg-secondary text-black' : 'bg-bg-card border border-white/10 text-gray-400'
                  }`}
                >
                  {cat.name.toUpperCase()}
                </button>
              ))}
            </div>

            {channels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                <Tv className="w-12 h-12" />
                <p className="text-xs font-bold">No channels available</p>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-xs font-bold">
                No channels found matching "{channelSearchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {filteredChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => openPlayer([{ name: 'Default', url: channel.streamUrl }])}
                    className="glass-card p-4 flex flex-col items-center gap-3 hover:border-secondary transition-all group aspect-square justify-center relative overflow-hidden"
                  >
                    <img 
                      src={channel.logoUrl || undefined} 
                      className="w-full h-12 object-contain z-10" 
                      alt={channel.name} 
                      onError={(e) => { e.currentTarget.src = 'https://placehold.co/60x45/222/fff?text=...'; }}
                    />
                    <span className="text-[10px] font-bold text-center line-clamp-2 z-10">{channel.name}</span>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <PlayCircle className="w-8 h-8 text-secondary drop-shadow-[0_0_10px_rgba(0,200,83,0.5)]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'highlights' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search highlights..." 
                value={highlightSearchQuery}
                onChange={(e) => setHighlightSearchQuery(e.target.value)}
                className="w-full bg-bg-card border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
              <button
                onClick={() => setHighlightFilter('All')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  highlightFilter === 'All' ? 'bg-primary text-white' : 'bg-bg-card border border-white/10 text-gray-400'
                }`}
              >
                ALL
              </button>
              {highlightCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setHighlightFilter(cat.name)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    highlightFilter === cat.name ? 'bg-primary text-white' : 'bg-bg-card border border-white/10 text-gray-400'
                  }`}
                >
                  {cat.name.toUpperCase()}
                </button>
              ))}
            </div>

            {highlights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                <PlayCircle className="w-12 h-12" />
                <p className="text-xs font-bold">No highlights available</p>
              </div>
            ) : filteredHighlights.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-xs font-bold">
                No highlights found matching "{highlightSearchQuery}"
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHighlights.map(highlight => (
                  <button
                    key={highlight.id}
                    onClick={() => openPlayer([{ name: 'Highlight', url: highlight.videoUrl }])}
                    className="w-full glass-card p-3 flex gap-4 text-left hover:border-primary transition-all group"
                  >
                    <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-primary/20">
                      <img src={highlight.thumbnailUrl || undefined} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="text-sm font-bold line-clamp-1 mb-1">{highlight.title}</h3>
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{highlight.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'playlist' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {settings?.playlists && settings.playlists.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
                {settings.playlists.map((pl, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadPlaylist(pl.url)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      currentPlaylistUrl === pl.url ? 'bg-primary text-white' : 'bg-bg-card border border-white/10 text-gray-400'
                    }`}
                  >
                    {pl.name.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
              <button
                onClick={() => setPlaylistFilter('All')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  playlistFilter === 'All' ? 'bg-secondary text-black' : 'bg-bg-card border border-white/10 text-gray-400'
                }`}
              >
                ALL
              </button>
              {Object.keys(playlistChannels).map(group => (
                <button
                  key={group}
                  onClick={() => setPlaylistFilter(group)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    playlistFilter === group ? 'bg-secondary text-black' : 'bg-bg-card border border-white/10 text-gray-400'
                  }`}
                >
                  {group.toUpperCase()}
                </button>
              ))}
            </div>

            {isPlaylistLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-secondary">Loading Playlist...</p>
              </div>
            ) : Object.keys(playlistChannels).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6 glass-card">
                <ShieldAlert className="w-12 h-12 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-bold text-white mb-1">Failed to load channels</p>
                  <p className="text-xs text-gray-400">The playlist might be temporarily unavailable.</p>
                </div>
                <button 
                  onClick={() => currentPlaylistUrl && loadPlaylist(currentPlaylistUrl)}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-full font-bold text-xs shadow-lg shadow-primary/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Loading
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {Object.entries(playlistChannels)
                  .filter(([group]) => playlistFilter === 'All' || group === playlistFilter)
                  .flatMap(([_, channels]) => channels)
                  .map((channel, idx) => (
                    <button
                      key={idx}
                      onClick={() => openPlayer([{ name: channel.name, url: channel.url }])}
                      className="glass-card p-4 flex flex-col items-center gap-3 hover:border-secondary transition-all group aspect-square justify-center relative"
                    >
                      <img 
                        src={channel.logo || 'https://placehold.co/60x45/222/fff?text=...'} 
                        className="w-full h-12 object-contain" 
                        alt={channel.name} 
                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/60x45/222/fff?text=...'; }}
                      />
                      <span className="text-[10px] font-bold text-center line-clamp-2">{channel.name}</span>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                        <PlayCircle className="w-8 h-8 text-secondary" />
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'about' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
            <h2 className="text-2xl font-black text-primary mb-6 border-b-2 border-primary pb-2 inline-block">About Nihat TV</h2>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p><strong className="text-white">Nihat TV</strong> is your ultimate destination for streaming live sports matches, thrilling highlights, and a vast collection of live TV channels, all in one place.</p>
              <p>This platform was developed and is passionately maintained by <a href="https://fb.com/nurnoby.rohman.99" target="_blank" rel="noopener noreferrer" className="font-black animate-neon text-lg inline-block hover:scale-110 transition-transform">নুরনবী রহমান</a>. We are constantly working to improve the service and add new features to enhance your viewing experience.</p>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-xs font-bold text-red-400 mb-2 uppercase tracking-wider">Disclaimer</p>
                <p className="text-xs">We do not host any content on our own servers. All streams and videos found on our platform are sourced from third-party services that are freely available on the internet. We are not responsible for the legality or copyright of the content.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'contact' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
            <h2 className="text-2xl font-black text-secondary mb-6 border-b-2 border-secondary pb-2 inline-block">Contact Us</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary/10 rounded-xl">
                  <Send className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Telegram</h3>
                  <p className="text-sm text-gray-400">For the quickest support and to join our community.</p>
                  <a href="https://t.me/nihattv" target="_blank" rel="noopener noreferrer" className="text-secondary text-sm font-bold mt-2 inline-block hover:underline">Join Official Channel</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Email</h3>
                  <p className="text-sm text-gray-400">For formal inquiries or copyright-related matters.</p>
                  <a href="mailto:sribordi2130@gmail.com" className="text-primary text-sm font-bold mt-2 inline-block hover:underline">sribordi2130@gmail.com</a>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'copyright' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
            <h2 className="text-2xl font-black text-white mb-6 border-b-2 border-white pb-2 inline-block">Copyright Policy</h2>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p><strong className="text-white">Nihat TV</strong> respects the intellectual property rights of others. All content is sourced from third-party websites publicly accessible on the internet.</p>
              <p>We do <strong className="text-white">not</strong> host, upload, or control any of the video content displayed. If you believe content infringes on your copyright, please contact the third-party provider.</p>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 text-center text-[10px] text-gray-500 border-t border-white/5">
        <FooterAdScript />
        <p>Copyright © {new Date().getFullYear()} Nihat TV. All Rights Reserved.</p>
      </footer>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass-card p-2 flex justify-around items-center z-50 shadow-2xl">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${activeTab === 'home' ? 'text-primary scale-110' : 'text-gray-500'}`}
        >
          <Home className={`w-6 h-6 ${activeTab === 'home' ? 'drop-shadow-[0_0_8px_rgba(230,0,35,0.5)]' : ''}`} />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('channels')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${activeTab === 'channels' ? 'text-secondary scale-110' : 'text-gray-500'}`}
        >
          <Tv className={`w-6 h-6 ${activeTab === 'channels' ? 'drop-shadow-[0_0_8px_rgba(0,200,83,0.5)]' : ''}`} />
          <span className="text-[10px] font-bold">Live TV</span>
        </button>
        <button 
          onClick={() => setActiveTab('highlights')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${activeTab === 'highlights' ? 'text-primary scale-110' : 'text-gray-500'}`}
        >
          <PlayCircle className={`w-6 h-6 ${activeTab === 'highlights' ? 'drop-shadow-[0_0_8px_rgba(230,0,35,0.5)]' : ''}`} />
          <span className="text-[10px] font-bold">Highlights</span>
        </button>
        {settings?.playlists && settings.playlists.length > 0 && (
          <button 
            onClick={() => setActiveTab('playlist')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all ${activeTab === 'playlist' ? 'text-secondary scale-110' : 'text-gray-500'}`}
          >
            <ListMusic className={`w-6 h-6 ${activeTab === 'playlist' ? 'drop-shadow-[0_0_8px_rgba(0,200,83,0.5)]' : ''}`} />
            <span className="text-[10px] font-bold">Playlist</span>
          </button>
        )}
      </nav>

      {/* Side Menu */}
      <AnimatePresence>
        {isSideMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSideMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#141419] z-[70] border-r border-primary/30 flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-black text-primary">MENU</h2>
                <button onClick={() => setIsSideMenuOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                {[
                  { id: 'home', icon: Home, label: 'Home' },
                  { id: 'channels', icon: Tv, label: 'Live TV' },
                  { id: 'highlights', icon: PlayCircle, label: 'Highlights' },
                  { id: 'playlist', icon: ListMusic, label: 'My Playlist' },
                  { id: 'contact', icon: Mail, label: 'Contact Us' },
                  { id: 'copyright', icon: ShieldAlert, label: 'Copyright' },
                  { id: 'about', icon: Info, label: 'About Us' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as Tab);
                      setIsSideMenuOpen(false);
                    }}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-primary/10 text-gray-400 hover:text-white transition-all group"
                  >
                    <item.icon className="w-6 h-6 group-hover:text-primary" />
                    <span className="font-bold">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedMatchServers && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-4"
          >
            <div className="w-full max-w-4xl relative">
              <button 
                onClick={closePlayer}
                className="absolute -top-12 right-0 p-2 bg-live-red text-white rounded-full shadow-xl hover:scale-110 transition-transform z-10"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="rounded-2xl overflow-hidden border-4 border-secondary shadow-[0_0_50px_rgba(0,200,83,0.3)] bg-black aspect-video relative">
                <video ref={videoRef} playsInline controls className="w-full h-full" />
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 border border-secondary/50 rounded text-[10px] font-black text-secondary z-20 pointer-events-none">
                  NIHAT TV
                </div>
              </div>

              <div className="mt-8 w-full glass-card p-6">
                <h3 className="text-secondary font-bold mb-4 flex items-center gap-2">
                  <ChevronRight className="w-5 h-5" />
                  Select Server
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedMatchServers.map((server, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentVideoUrl(server.url);
                        setActiveServerIndex(idx);
                      }}
                      className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                        activeServerIndex === idx 
                        ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105 border-2 border-white' 
                        : 'bg-white/5 border border-white/10 text-secondary hover:bg-white/10'
                      }`}
                    >
                      {server.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      <AnimatePresence>
        {isAlertOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass-card p-8 border-yellow-400 text-center relative"
            >
              <button onClick={() => setIsAlertOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
              <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-black text-yellow-400 mb-2">{settings?.alertTitle || 'Alert'}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{settings?.alertMessage || 'Please be careful.'}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
