import { http, HttpResponse } from 'msw';

// Default handlers for common endpoints
export const handlers = [
  // IPFS gateway handlers
  http.get('https://ipfs.io/ipfs/:cid', ({ params }) => {
    const cid = params.cid as string;

    // Return mock metadata for known test CIDs
    if (cid === 'QmTestMetadataCID12345678901234567890123') {
      return HttpResponse.json({
        name: 'Test NFT',
        description: 'A test NFT for unit testing',
        image: 'ipfs://QmTestImageCID1234567890123456789012345678',
        animation_url: 'ipfs://QmTestAnimationCID123456789012345678901234',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Size', value: 'Large' },
        ],
      });
    }

    // Return mock image for image CIDs
    if (cid.startsWith('QmTestImage')) {
      return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        headers: { 'Content-Type': 'image/png' },
      });
    }

    // Return 404 for unknown CIDs
    return new HttpResponse(null, { status: 404 });
  }),

  // Cloudflare IPFS gateway
  http.get('https://cloudflare-ipfs.com/ipfs/:cid', ({ params }) => {
    const cid = params.cid as string;

    if (cid === 'QmTestMetadataCID12345678901234567890123') {
      return HttpResponse.json({
        name: 'Test NFT',
        description: 'A test NFT',
        image: 'ipfs://QmTestImageCID1234567890123456789012345678',
      });
    }

    return new HttpResponse(null, { status: 404 });
  }),

  // Centralized API mock
  http.get('https://api.example.com/nft/:id', ({ params }) => {
    const id = params.id as string;

    return HttpResponse.json({
      name: `NFT #${id}`,
      description: 'A centralized NFT',
      image: 'https://cdn.example.com/images/nft.png',
    });
  }),

  // Mock image endpoints
  http.get('https://cdn.example.com/images/:filename', () => {
    return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': '8',
      },
    });
  }),

  // Mock Arweave gateway
  http.get('https://arweave.net/:txId', ({ params }) => {
    const txId = params.txId as string;

    if (txId === 'testTxId123') {
      return HttpResponse.json({
        name: 'Arweave NFT',
        description: 'Stored on Arweave',
        image: 'ar://testImageTxId456',
      });
    }

    return new HttpResponse(null, { status: 404 });
  }),
];
