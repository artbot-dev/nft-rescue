(() => {
  'use strict';

  const FILTER_DEFAULTS = {
    chain: 'all',
    wallet: 'all',
    collection: 'all',
    storage: 'all',
    traitType: '',
    traitValue: '',
    search: '',
  };

  const state = {
    index: null,
    manifests: [],
    nfts: [],
    nftById: new Map(),
    chainNameById: new Map(),
    filters: { ...FILTER_DEFAULTS },
    defaultFilters: { ...FILTER_DEFAULTS },
    view: 'gallery',
    route: {},
    remoteFallback: false,
    baseDir: '',
    rootName: '',
    inlineData: null,
    isFileProtocol: false,
    traitsReady: false,
  };

  const dom = {};

  function cacheDom() {
    dom.filterWallet = document.getElementById('filterWallet');
    dom.filterChain = document.getElementById('filterChain');
    dom.filterCollection = document.getElementById('filterCollection');
    dom.filterStorage = document.getElementById('filterStorage');
    dom.filterTraitType = document.getElementById('filterTraitType');
    dom.filterTraitValue = document.getElementById('filterTraitValue');
    dom.filterSearch = document.getElementById('filterSearch');
    dom.resetFilters = document.getElementById('resetFilters');
    dom.toggleRemote = document.getElementById('toggleRemote');
    dom.toggleRemoteLabel = document.getElementById('toggleRemoteLabel');
    dom.grid = document.getElementById('grid');
    dom.detail = document.getElementById('detail');
    dom.status = document.getElementById('status');
    dom.resultCount = document.getElementById('resultCount');
    dom.breadcrumbs = document.getElementById('breadcrumbs');
    dom.collectionHeader = document.getElementById('collectionHeader');
    dom.collectionTitle = document.getElementById('collectionTitle');
    dom.collectionClear = document.getElementById('collectionClear');
  }

  function bindEvents() {
    dom.toggleRemote.addEventListener('change', () => {
      state.remoteFallback = dom.toggleRemote.checked;
      render();
    });

    dom.filterWallet.addEventListener('change', () => {
      state.filters.wallet = dom.filterWallet.value;
      state.filters.collection = 'all';
      state.filters.traitType = '';
      state.filters.traitValue = '';
      navigateToGallery();
    });

    dom.filterChain.addEventListener('change', () => {
      state.filters.chain = dom.filterChain.value;
      state.filters.wallet = 'all';
      state.filters.collection = 'all';
      state.filters.traitType = '';
      state.filters.traitValue = '';
      navigateToGallery();
    });

    dom.filterCollection.addEventListener('change', () => {
      const value = dom.filterCollection.value;
      if (value === 'all') {
        navigateToGallery();
      } else {
        navigateToCollection(value);
      }
    });

    dom.filterStorage.addEventListener('change', () => {
      state.filters.storage = dom.filterStorage.value;
      render();
    });

    dom.filterTraitType.addEventListener('change', () => {
      state.filters.traitType = dom.filterTraitType.value;
      state.filters.traitValue = '';
      render();
    });

    dom.filterTraitValue.addEventListener('change', () => {
      state.filters.traitValue = dom.filterTraitValue.value;
      render();
    });

    dom.filterSearch.addEventListener('input', () => {
      state.filters.search = dom.filterSearch.value.trim();
      render();
    });

    dom.resetFilters.addEventListener('click', () => {
      state.filters = { ...state.defaultFilters };
      dom.filterSearch.value = '';
      navigateToGallery();
    });

    dom.collectionClear.addEventListener('click', () => {
      navigateToGallery();
    });

    window.addEventListener('hashchange', () => {
      applyRoute();
      render();
    });
  }

  function getContext() {
    const href = window.location.href.split('#')[0];
    const baseDir = href.slice(0, href.lastIndexOf('/') + 1);
    const path = window.location.pathname.replace(/\\/g, '/');
    const parts = path.split('/').filter(Boolean);
    let rootName = '';
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      rootName = last.endsWith('.html') ? (parts[parts.length - 2] || '') : last;
    }
    return { baseDir, rootName };
  }

  function getInlineGalleryData() {
    const data = window.__NFT_RESCUE_GALLERY__;
    if (!data || typeof data !== 'object') return null;
    if (!data.index || !data.manifests) return null;
    return data;
  }

  async function loadData() {
    setStatus('Loading manifest index...');
    const index = await loadManifestIndex();
    if (!index) {
      if (state.isFileProtocol) {
        setError(
          'Local file access is blocked by the browser. Re-run backup with the latest version to generate gallery-data.js, or serve this folder over http.'
        );
      } else {
        setError('Manifest index not found. Run a new backup to generate manifests/index.json.');
      }
      return;
    }

    state.index = index;
    for (const entry of index.manifests) {
      state.chainNameById.set(entry.chainId, entry.chainName);
    }

    const defaultManifest = pickDefaultManifest(index.manifests);
    if (defaultManifest) {
      state.filters.chain = defaultManifest.chainName;
      state.filters.wallet = defaultManifest.walletAddress;
    }
    state.defaultFilters = { ...state.filters };

    setStatus('Loading manifests...');
    const manifests = await loadAllManifests(index.manifests);
    state.manifests = manifests;
    state.nfts = buildNftsFromManifests(manifests, index.manifests);
    state.nftById = new Map(state.nfts.map((nft) => [nft.id, nft]));

    setStatus('Loading metadata for traits...');
    await hydrateMetadata(state.nfts);
    state.traitsReady = true;

    applyRoute();
    render();
    clearStatus();
  }

  async function loadManifestIndex() {
    if (state.inlineData && state.inlineData.index) {
      return state.inlineData.index;
    }
    if (state.isFileProtocol) {
      return null;
    }
    try {
      const url = new URL('manifests/index.json', state.baseDir).toString();
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.manifests)) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function pickDefaultManifest(entries) {
    if (!entries || entries.length === 0) return null;
    const ethereumEntries = entries.filter((entry) =>
      String(entry.chainName).toLowerCase() === 'ethereum'
    );
    const pool = ethereumEntries.length > 0 ? ethereumEntries : entries;
    const sorted = [...pool].sort(compareWalletEntries);
    return sorted[0] || null;
  }

  function compareWalletEntries(a, b) {
    const aName = (a.walletName || '').trim();
    const bName = (b.walletName || '').trim();
    if (aName && !bName) return -1;
    if (bName && !aName) return 1;
    const aKey = (aName || a.walletAddress || '').toLowerCase();
    const bKey = (bName || b.walletAddress || '').toLowerCase();
    return aKey.localeCompare(bKey);
  }

  async function loadAllManifests(entries) {
    const results = [];
    for (const entry of entries) {
      const manifest = await loadManifest(entry);
      if (manifest) {
        results.push({ manifest, entry });
      }
    }
    return results;
  }

  async function loadManifest(entry) {
    if (state.inlineData && state.inlineData.manifests && state.inlineData.manifests[entry.path]) {
      return state.inlineData.manifests[entry.path];
    }
    if (state.isFileProtocol) {
      return null;
    }
    try {
      const url = new URL(entry.path, state.baseDir).toString();
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }

  function buildNftsFromManifests(loaded, indexEntries) {
    const nfts = [];
    const indexByPath = new Map(indexEntries.map((entry) => [entry.path, entry]));

    for (const { manifest, entry } of loaded) {
      const indexEntry = indexByPath.get(entry.path) || entry;
      const walletName = manifest.ensName || indexEntry.walletName || '';
      for (const item of manifest.nfts || []) {
        const nft = normalizeManifestEntry(manifest, item, walletName);
        nfts.push(nft);
      }
    }

    return nfts;
  }

  function normalizeManifestEntry(manifest, item, walletName) {
    const metadataPath = normalizeManifestPath(item.metadataFile);
    const imagePath = normalizeManifestPath(item.imageFile);
    const animationPath = normalizeManifestPath(item.animationFile);
    const storageReportPath = normalizeManifestPath(item.storageReportFile);
    const id = `${manifest.chainId}:${item.contractAddress}:${item.tokenId}`;
    const traits = Array.isArray(item.traits)
      ? item.traits.map((trait) => ({
          trait_type: String(trait.trait_type),
          value: String(trait.value),
          display_type: trait.display_type ? String(trait.display_type) : undefined,
        }))
      : [];
    const imageUrl = item.imageUrl ? String(item.imageUrl) : null;
    const animationUrl = item.animationUrl ? String(item.animationUrl) : null;
    const collectionLabel = item.collectionName ? String(item.collectionName) : '';

    return {
      id,
      chainName: manifest.chainName,
      chainId: manifest.chainId,
      walletAddress: manifest.walletAddress,
      walletName: walletName,
      contractAddress: item.contractAddress,
      tokenId: item.tokenId,
      name: item.name || '',
      metadataPath,
      imagePath,
      animationPath,
      storageReportPath,
      storageStatus: item.storageStatus,
      error: item.error || '',
      traits,
      metadata: null,
      media: {
        imagePath,
        animationPath,
        imageUrl,
        animationUrl,
      },
      collectionId: item.contractAddress,
      collectionKey: `${manifest.chainId}:${item.contractAddress}`,
      collectionLabel,
    };
  }

  function normalizeManifestPath(path) {
    if (!path) return '';
    let normalized = String(path).replace(/\\/g, '/');
    normalized = normalized.replace(/^\.\/+/, '');

    if (state.rootName) {
      const marker = `/${state.rootName}/`;
      const idx = normalized.lastIndexOf(marker);
      if (idx !== -1) {
        normalized = normalized.slice(idx + marker.length);
      } else if (normalized.startsWith(`${state.rootName}/`)) {
        normalized = normalized.slice(state.rootName.length + 1);
      }
    }

    const fallbackMarkers = ['/nfts/', '/manifests/'];
    for (const marker of fallbackMarkers) {
      const idx = normalized.lastIndexOf(marker);
      if (idx !== -1) {
        normalized = normalized.slice(idx + 1);
        break;
      }
    }

    normalized = normalized.replace(/^\/+/, '');
    return normalized;
  }

  async function hydrateMetadata(nfts) {
    if (state.isFileProtocol) {
      for (const nft of nfts) {
        if (!nft.collectionLabel) {
          nft.collectionLabel = shortenAddress(nft.contractAddress);
        }
      }
      return;
    }

    const queue = nfts.filter(needsMetadata);
    if (queue.length === 0) {
      return;
    }

    const concurrency = 6;
    let done = 0;
    const total = queue.length;

    async function worker() {
      while (queue.length > 0) {
        const nft = queue.shift();
        if (!nft) break;
        nft.metadata = await loadMetadata(nft.metadataPath);
        if (nft.metadata) {
          if (nft.traits.length === 0) {
            nft.traits = normalizeTraits(nft.metadata);
          }
          const mediaUrls = extractMediaUrls(nft.metadata);
          if (!nft.media.imageUrl && mediaUrls.imageUrl) {
            nft.media.imageUrl = mediaUrls.imageUrl;
          }
          if (!nft.media.animationUrl && mediaUrls.animationUrl) {
            nft.media.animationUrl = mediaUrls.animationUrl;
          }
          if (!nft.collectionLabel) {
            nft.collectionLabel = getCollectionLabel(nft, nft.metadata);
          }
        }
        done += 1;
        setStatus(`Loading metadata for traits... ${done}/${total}`);
      }
    }

    const workers = Array.from({ length: concurrency }, worker);
    await Promise.all(workers);
  }

  function needsMetadata(nft) {
    if (!nft.metadataPath) return false;
    if (nft.traits.length === 0) return true;
    if (!nft.collectionLabel) return true;
    if (!nft.media.imageUrl && !nft.media.animationUrl) return true;
    return false;
  }

  async function loadMetadata(path) {
    if (!path) return null;
    if (state.isFileProtocol) return null;
    try {
      const url = new URL(encodeURI(path), state.baseDir).toString();
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }

  function normalizeTraits(metadata) {
    if (!metadata) return [];
    const traits = [];

    const candidates = [metadata.attributes, metadata.traits, metadata.properties];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (Array.isArray(candidate)) {
        for (const entry of candidate) {
          if (!entry || typeof entry !== 'object') continue;
          const traitType = entry.trait_type || entry.type || entry.name;
          const value = entry.value ?? entry.val;
          if (traitType === undefined || value === undefined) continue;
          traits.push({
            trait_type: String(traitType),
            value: String(value),
            display_type: entry.display_type ? String(entry.display_type) : undefined,
          });
        }
      } else if (typeof candidate === 'object') {
        for (const [key, value] of Object.entries(candidate)) {
          if (value && typeof value === 'object' && 'value' in value) {
            const val = value.value;
            if (val === undefined) continue;
            traits.push({
              trait_type: String(key),
              value: String(val),
              display_type: value.display_type ? String(value.display_type) : undefined,
            });
          } else if (value !== undefined) {
            traits.push({
              trait_type: String(key),
              value: String(value),
              display_type: undefined,
            });
          }
        }
      }
    }

    return traits;
  }

  function extractMediaUrls(metadata) {
    if (!metadata) return { imageUrl: null, animationUrl: null };

    const image = metadata.image || metadata.image_url || metadata.imageUrl;
    const animation = metadata.animation_url || metadata.animationUrl;
    const contentUri = metadata.content && metadata.content.uri ? metadata.content.uri : null;

    let imageUrl = normalizeRemoteUrl(image);
    let animationUrl = normalizeRemoteUrl(animation);

    if (!animationUrl && contentUri) {
      const normalized = normalizeRemoteUrl(contentUri);
      if (normalized && isVideo(normalized)) {
        animationUrl = normalized;
      } else if (!imageUrl) {
        imageUrl = normalized;
      }
    }

    return { imageUrl, animationUrl };
  }

  function normalizeRemoteUrl(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('ipfs://')) {
      const stripped = url.replace('ipfs://', '').replace('ipfs/', '');
      return `https://ipfs.io/ipfs/${stripped}`;
    }
    if (url.startsWith('ar://')) {
      return `https://arweave.net/${url.replace('ar://', '')}`;
    }
    return url;
  }

  function getCollectionLabel(nft, metadataOverride) {
    const metadata = metadataOverride || nft.metadata || {};
    const label =
      (metadata.collection && metadata.collection.name) ||
      metadata.collectionName ||
      (metadata.contract && metadata.contract.name);
    return label ? String(label) : shortenAddress(nft.contractAddress);
  }

  function shortenAddress(address) {
    if (!address) return 'Unknown';
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function applyRoute() {
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash === 'gallery') {
      state.view = 'gallery';
      state.filters.collection = 'all';
      return;
    }

    const [route, rawId] = hash.split('/');
    if (route === 'collection' && rawId) {
      const decoded = decodeURIComponent(rawId);
      const [chainId, contract] = decoded.split(':');
      const chainName = state.chainNameById.get(Number(chainId));
      if (chainName) {
        state.filters.chain = chainName;
      }
      state.filters.collection = contract || 'all';
      state.view = 'collection';
      return;
    }

    if (route === 'artwork' && rawId) {
      const decoded = decodeURIComponent(rawId);
      state.view = 'artwork';
      state.route = { id: decoded };
      return;
    }

    state.view = 'gallery';
  }

  function navigateToGallery() {
    if (window.location.hash === '#gallery') {
      applyRoute();
      render();
      return;
    }
    window.location.hash = '#gallery';
  }

  function navigateToCollection(collectionKey) {
    const target = `#collection/${encodeURIComponent(collectionKey)}`;
    if (window.location.hash === target) {
      applyRoute();
      render();
      return;
    }
    window.location.hash = target;
  }

  function navigateToArtwork(id) {
    const target = `#artwork/${encodeURIComponent(id)}`;
    if (window.location.hash === target) {
      applyRoute();
      render();
      return;
    }
    window.location.hash = target;
  }

  function render() {
    updateFilterOptions();

    const filtered = applyFilters(state.nfts);
    dom.resultCount.textContent = `${filtered.length} items`;

    if (state.view === 'artwork') {
      renderBreadcrumbs('Artwork');
      renderDetail(state.route.id);
      dom.grid.classList.add('hidden');
      dom.detail.classList.remove('hidden');
      dom.collectionHeader.classList.add('hidden');
      return;
    }

    dom.detail.classList.add('hidden');
    dom.grid.classList.remove('hidden');

    if (state.view === 'collection') {
      const collectionLabel = getCollectionLabelFromFilter(filtered);
      dom.collectionTitle.textContent = collectionLabel;
      dom.collectionHeader.classList.remove('hidden');
      renderBreadcrumbs('Collection');
    } else {
      dom.collectionHeader.classList.add('hidden');
      renderBreadcrumbs('Gallery');
    }

    renderGrid(filtered);
  }

  function updateFilterOptions() {
    const manifestEntries = state.index ? state.index.manifests : [];
    const chainOptions = getUniqueChains(manifestEntries);
    updateSelect(dom.filterChain, chainOptions, state.filters.chain, 'All chains', 'all');

    const walletOptions = getUniqueWallets(manifestEntries, state.filters.chain);
    updateSelect(dom.filterWallet, walletOptions, state.filters.wallet, 'All wallets', 'all');

    const collectionOptions = getUniqueCollections(state.nfts, state.filters);
    updateSelect(dom.filterCollection, collectionOptions, state.filters.collection, 'All collections', 'all');

    const traitOptions = getTraitOptions(state.nfts, state.filters);
    updateSelect(dom.filterTraitType, traitOptions.types, state.filters.traitType, 'All traits', '');
    updateSelect(dom.filterTraitValue, traitOptions.values, state.filters.traitValue, 'Any value', '');

    dom.filterCollection.disabled = state.view === 'collection';
    dom.filterTraitValue.disabled = !state.filters.traitType;
  }

  function getUniqueChains(entries) {
    const names = new Map();
    for (const entry of entries) {
      names.set(entry.chainName, entry.chainName);
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }

  function getUniqueWallets(entries, chain) {
    const wallets = new Map();
    for (const entry of entries) {
      if (chain !== 'all' && entry.chainName !== chain) continue;
      const label = entry.walletName || shortenAddress(entry.walletAddress);
      wallets.set(entry.walletAddress, label);
    }
    return [...wallets.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }

  function getUniqueCollections(nfts, filters) {
    const collections = new Map();
    for (const nft of nfts) {
      if (filters.chain !== 'all' && nft.chainName !== filters.chain) continue;
      if (filters.wallet !== 'all' && nft.walletAddress !== filters.wallet) continue;
      const label = nft.collectionLabel || shortenAddress(nft.contractAddress);
      collections.set(nft.collectionId, label);
    }
    return [...collections.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }

  function getTraitOptions(nfts, filters) {
    const types = new Map();
    const values = new Map();
    for (const nft of nfts) {
      if (filters.chain !== 'all' && nft.chainName !== filters.chain) continue;
      if (filters.wallet !== 'all' && nft.walletAddress !== filters.wallet) continue;
      if (filters.collection !== 'all' && nft.contractAddress !== filters.collection) continue;
      for (const trait of nft.traits || []) {
        if (!trait.trait_type) continue;
        types.set(trait.trait_type, trait.trait_type);
        if (filters.traitType && trait.trait_type !== filters.traitType) continue;
        values.set(trait.value, trait.value);
      }
    }
    return {
      types: [...types.values()].sort((a, b) => a.localeCompare(b)),
      values: [...values.values()].sort((a, b) => a.localeCompare(b)),
    };
  }

  function updateSelect(select, options, selectedValue, placeholder, placeholderValue) {
    const hasStringOptions = options.length > 0 && typeof options[0] === 'string';
    const normalized = hasStringOptions
      ? options
      : options.map((option) => option.value);

    const current = select.value || selectedValue;
    select.innerHTML = '';
    if (placeholder) {
      const opt = document.createElement('option');
      opt.value = placeholderValue;
      opt.textContent = placeholder;
      select.appendChild(opt);
    }

    if (hasStringOptions) {
      for (const option of options) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
      }
    } else {
      for (const option of options) {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        select.appendChild(opt);
      }
    }

    if (normalized.includes(current)) {
      select.value = current;
    } else if (selectedValue && normalized.includes(selectedValue)) {
      select.value = selectedValue;
    }
  }

  function applyFilters(nfts) {
    return nfts.filter((nft) => {
      if (state.filters.chain !== 'all' && nft.chainName !== state.filters.chain) return false;
      if (state.filters.wallet !== 'all' && nft.walletAddress !== state.filters.wallet) return false;
      if (state.filters.collection !== 'all' && nft.contractAddress !== state.filters.collection) return false;
      if (state.filters.storage !== 'all' && nft.storageStatus !== state.filters.storage) return false;

      if (state.filters.search) {
        const query = state.filters.search.toLowerCase();
        const haystack = [
          nft.name,
          nft.tokenId,
          nft.contractAddress,
          nft.collectionLabel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (state.filters.traitType) {
        const hasType = nft.traits.some((trait) => trait.trait_type === state.filters.traitType);
        if (!hasType) return false;
      }

      if (state.filters.traitValue && state.filters.traitType) {
        const hasValue = nft.traits.some(
          (trait) =>
            trait.trait_type === state.filters.traitType && trait.value === state.filters.traitValue
        );
        if (!hasValue) return false;
      }

      return true;
    });
  }

  function renderGrid(nfts) {
    dom.grid.innerHTML = '';

    if (nfts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No NFTs match the current filters.';
      dom.grid.appendChild(empty);
      return;
    }

    nfts.forEach((nft, index) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.style.setProperty('--i', index);
      card.addEventListener('click', () => navigateToArtwork(nft.id));

      const media = document.createElement('div');
      media.className = 'card-media';
      const mediaNode = createMediaNode(nft, { mode: 'grid' });
      media.appendChild(mediaNode);

      const body = document.createElement('div');
      body.className = 'card-body';

      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = nft.name || `Token #${nft.tokenId}`;

      const meta = document.createElement('div');
      meta.className = 'card-meta';

      const collection = document.createElement('span');
      collection.className = 'collection-link';
      collection.textContent = nft.collectionLabel || shortenAddress(nft.contractAddress);
      collection.addEventListener('click', (event) => {
        event.stopPropagation();
        navigateToCollection(nft.collectionKey);
      });

      const chain = document.createElement('span');
      chain.textContent = nft.chainName;

      meta.appendChild(collection);
      meta.appendChild(chain);

      const badge = document.createElement('span');
      badge.className = `badge ${nft.storageStatus}`;
      badge.textContent = nft.storageStatus;

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(badge);

      card.appendChild(media);
      card.appendChild(body);
      dom.grid.appendChild(card);
    });
  }

  function renderDetail(id) {
    dom.detail.innerHTML = '';
    const nft = state.nftById.get(id);

    if (!nft) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Artwork not found.';
      dom.detail.appendChild(empty);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'detail-layout';

    const media = document.createElement('div');
    media.className = 'detail-media';
    const mediaNode = createMediaNode(nft, { mode: 'detail' });
    media.appendChild(mediaNode);

    const meta = document.createElement('div');
    meta.className = 'detail-meta';

    const title = document.createElement('h2');
    title.textContent = nft.name || `Token #${nft.tokenId}`;

    const lines = [
      `Collection: ${nft.collectionLabel || shortenAddress(nft.contractAddress)}`,
      `Contract: ${shortenAddress(nft.contractAddress)}`,
      `Token ID: ${nft.tokenId}`,
      `Chain: ${nft.chainName}`,
      `Wallet: ${nft.walletName || shortenAddress(nft.walletAddress)}`,
    ];

    const lineContainer = document.createElement('div');
    for (const line of lines) {
      const p = document.createElement('div');
      p.className = 'line';
      p.textContent = line;
      lineContainer.appendChild(p);
    }

    const status = document.createElement('span');
    status.className = `badge ${nft.storageStatus}`;
    status.textContent = nft.storageStatus;

    const traits = document.createElement('div');
    traits.className = 'detail-tags';
    if (nft.traits.length === 0) {
      const empty = document.createElement('span');
      empty.textContent = 'No traits';
      traits.appendChild(empty);
    } else {
      nft.traits.slice(0, 16).forEach((trait) => {
        const tag = document.createElement('span');
        tag.textContent = `${trait.trait_type}: ${trait.value}`;
        traits.appendChild(tag);
      });
    }

    const links = document.createElement('div');
    links.className = 'detail-links';
    if (nft.metadataPath) {
      const link = document.createElement('a');
      link.href = encodeURI(nft.metadataPath);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'View metadata.json';
      links.appendChild(link);
    }

    if (nft.storageReportPath) {
      const report = document.createElement('a');
      report.href = encodeURI(nft.storageReportPath);
      report.target = '_blank';
      report.rel = 'noopener';
      report.textContent = 'View storage report';
      links.appendChild(report);
    }

    meta.appendChild(title);
    meta.appendChild(lineContainer);
    meta.appendChild(status);
    meta.appendChild(traits);
    meta.appendChild(links);

    layout.appendChild(media);
    layout.appendChild(meta);

    dom.detail.appendChild(layout);
  }

  function createMediaNode(nft, { mode }) {
    const local = pickLocalMedia(nft, mode);
    const remote = state.remoteFallback ? pickRemoteMedia(nft, mode) : null;
    const fallback = local || remote;

    if (!fallback) {
      const placeholder = document.createElement('div');
      placeholder.textContent = 'No media';
      placeholder.className = 'empty';
      return placeholder;
    }

    const element = fallback.type === 'video' ? document.createElement('video') : document.createElement('img');
    const primarySrc = encodeURI(fallback.src);
    element.src = primarySrc;

    if (fallback.type === 'video') {
      element.controls = mode === 'detail';
      element.loop = true;
      element.muted = true;
      element.playsInline = true;
      if (mode === 'detail') {
        element.autoplay = true;
      }
    }

    if (remote && fallback !== remote) {
      element.onerror = () => {
        element.src = encodeURI(remote.src);
      };
    }

    return element;
  }

  function pickLocalMedia(nft, mode) {
    if (mode === 'detail') {
      const animation = nft.media.animationPath;
      if (animation) {
        return { src: animation, type: isVideo(animation) ? 'video' : 'image' };
      }
    }
    const image = nft.media.imagePath;
    if (image) {
      return { src: image, type: 'image' };
    }
    if (mode !== 'detail') {
      const animation = nft.media.animationPath;
      if (animation) {
        return { src: animation, type: isVideo(animation) ? 'video' : 'image' };
      }
    }
    return null;
  }

  function pickRemoteMedia(nft, mode) {
    if (mode === 'detail') {
      const animation = nft.media.animationUrl;
      if (animation) {
        return { src: animation, type: isVideo(animation) ? 'video' : 'image' };
      }
    }
    const image = nft.media.imageUrl;
    if (image) {
      return { src: image, type: 'image' };
    }
    if (mode !== 'detail') {
      const animation = nft.media.animationUrl;
      if (animation) {
        return { src: animation, type: isVideo(animation) ? 'video' : 'image' };
      }
    }
    return null;
  }

  function isVideo(path) {
    return /(\.mp4|\.webm|\.mov|\.m4v|\.ogv|\.glb|\.gltf)$/i.test(path);
  }

  function renderBreadcrumbs(current) {
    dom.breadcrumbs.innerHTML = '';
    const galleryLink = document.createElement('a');
    galleryLink.href = '#gallery';
    galleryLink.textContent = 'Gallery';
    dom.breadcrumbs.appendChild(galleryLink);

    if (current !== 'Gallery') {
      const span = document.createElement('span');
      span.textContent = ` / ${current}`;
      dom.breadcrumbs.appendChild(span);
    }
  }

  function getCollectionLabelFromFilter(nfts) {
    if (nfts.length === 0) return 'Collection';
    return nfts[0].collectionLabel || shortenAddress(nfts[0].contractAddress);
  }

  function setStatus(message) {
    dom.status.textContent = message;
    dom.status.classList.remove('error');
  }

  function clearStatus() {
    dom.status.textContent = '';
    dom.status.classList.remove('error');
  }

  function setError(message) {
    dom.status.textContent = message;
    dom.status.classList.add('error');
  }

  function init() {
    cacheDom();
    bindEvents();

    const context = getContext();
    state.baseDir = context.baseDir;
    state.rootName = context.rootName;
    state.isFileProtocol = window.location.protocol === 'file:';
    state.inlineData = getInlineGalleryData();
    updateRemoteFallbackNote();

    loadData();
  }

  function updateRemoteFallbackNote() {
    if (!dom.toggleRemoteLabel) return;
    let note = '';
    if (state.isFileProtocol) {
      note = 'Remote fallback may be blocked on file://. Serve this folder over http for best results.';
    }
    dom.toggleRemoteLabel.title = note || 'Load remote media when local files are missing.';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
