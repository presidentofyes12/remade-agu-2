import { IPFSService } from '../IPFSService';
import { Publication } from '../LibraryService';

// Mock IPFS client
jest.mock('ipfs-http-client', () => ({
  create: jest.fn().mockReturnValue({
    add: jest.fn(),
    cat: jest.fn(),
    pin: {
      add: jest.fn(),
      rm: jest.fn()
    }
  })
}));

describe('IPFSService', () => {
  let ipfsService: IPFSService;
  const mockGateway = 'https://ipfs.io';

  const mockPublication: Publication = {
    content: 'Test content',
    metadata: {
      title: 'Test Publication',
      author: 'Test Author',
      mediaType: 'article',
      timestamp: Date.now(),
      ageRating: 13,
      privilegeLevel: 'public'
    }
  };

  beforeEach(() => {
    ipfsService = new IPFSService(mockGateway);
  });

  describe('Initialization', () => {
    it('should initialize with default gateway', () => {
      const service = new IPFSService();
      expect(service).toBeDefined();
    });

    it('should initialize with custom gateway', () => {
      const customGateway = 'https://custom-ipfs-gateway.com';
      const service = new IPFSService(customGateway);
      expect(service).toBeDefined();
    });
  });

  describe('Publication Upload', () => {
    it('should successfully upload a publication', async () => {
      const mockCid = 'QmTest123';
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.add.mockResolvedValue({ path: mockCid });

      const cid = await ipfsService.uploadPublication(mockPublication);

      expect(cid).toBe(mockCid);
      expect(mockIpfs.add).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should handle upload errors', async () => {
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.add.mockRejectedValue(new Error('Upload failed'));

      await expect(ipfsService.uploadPublication(mockPublication))
        .rejects
        .toThrow('Failed to upload publication to IPFS');
    });
  });

  describe('Publication Retrieval', () => {
    it('should successfully retrieve a publication', async () => {
      const mockCid = 'QmTest123';
      const mockData = JSON.stringify(mockPublication);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(mockData);
        }
      };

      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.cat.mockResolvedValue(mockStream);

      const publication = await ipfsService.getPublication(mockCid);

      expect(publication).toEqual(mockPublication);
      expect(mockIpfs.cat).toHaveBeenCalledWith(mockCid);
    });

    it('should handle retrieval errors', async () => {
      const mockCid = 'QmTest123';
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.cat.mockRejectedValue(new Error('Retrieval failed'));

      await expect(ipfsService.getPublication(mockCid))
        .rejects
        .toThrow('Failed to retrieve publication from IPFS');
    });
  });

  describe('Gateway URL', () => {
    it('should return correct gateway URL', () => {
      const cid = 'QmTest123';
      const url = ipfsService.getGatewayUrl(cid);
      expect(url).toBe(`${mockGateway}/ipfs/${cid}`);
    });
  });

  describe('Publication Pinning', () => {
    it('should successfully pin a publication', async () => {
      const mockCid = 'QmTest123';
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.pin.add.mockResolvedValue(undefined);

      await ipfsService.pinPublication(mockCid);

      expect(mockIpfs.pin.add).toHaveBeenCalledWith(mockCid);
    });

    it('should handle pinning errors', async () => {
      const mockCid = 'QmTest123';
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.pin.add.mockRejectedValue(new Error('Pinning failed'));

      await expect(ipfsService.pinPublication(mockCid))
        .rejects
        .toThrow('Failed to pin publication');
    });
  });

  describe('Publication Unpinning', () => {
    it('should successfully unpin a publication', async () => {
      const mockCid = 'QmTest123';
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.pin.rm.mockResolvedValue(undefined);

      await ipfsService.unpinPublication(mockCid);

      expect(mockIpfs.pin.rm).toHaveBeenCalledWith(mockCid);
    });

    it('should handle unpinning errors', async () => {
      const mockCid = 'QmTest123';
      const mockIpfs = require('ipfs-http-client').create();
      mockIpfs.pin.rm.mockRejectedValue(new Error('Unpinning failed'));

      await expect(ipfsService.unpinPublication(mockCid))
        .rejects
        .toThrow('Failed to unpin publication');
    });
  });
}); 