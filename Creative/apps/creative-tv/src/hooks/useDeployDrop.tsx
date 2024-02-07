import { useEffect, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useSigner, useAddress } from '@thirdweb-dev/react';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { CREATIVE_ADDRESS } from 'utils/config';
import { AssetData } from '../components/CreateAndViewAsset';

interface WagmiNftProps {
  assetId: string;
  assetData: AssetData;
}

// Custom hook for deploying edition drop contract
const useDeployEditionDrop = ({ assetId, assetData }: WagmiNftProps): void => {
  const toast = useToast();
  const address = useAddress();
  const signer = useSigner();
  const [ deployedContract, setDeployedContract ] = useState('');

  if (address && signer) {
    const sdk = ThirdwebSDK.fromSigner(signer)

    useEffect(() => {
      // Function to deploy the edition drop contract
      const deployEditionDrop = async () => {
        try {
          // Deploy the edition drop contract
          const editionDropAddress = await sdk.deployer.deployBuiltInContract('edition-drop', {
            name: 'CRTV Episode Drop', // Name of the edition drop
            primary_sale_recipient: address, // Address of the primary sale recipient
            app_uri: "https://tv.creativeplatform.xyz", // Website of your contract dApp
            symbol: 'EPISD', // Symbol of the edition drop
            tokenURI: `https://ipfs.io/ipfs/${assetData.properties.videoIpfs}`, // IPFS URI of the video
            platform_fee_basis_points: 200,
            platform_fee_recipient: CREATIVE_ADDRESS,
            fee_recipient: address,
            seller_fee_basis_points: 300,
            metadata: {
              id: assetId, // ID of the video
              name: assetData.title, // Title of the video
              description: assetData.description, // Description of the video
              image: assetData.image_url, // Thumbnail of the video
              properties: {
                playbackId: assetData.properties.playbackId, // Playback ID of the video
                videoIpfs: assetData.properties.videoIpfs, // IPFS URI of the video
              },
            },
          });

          // Update the editionDropAddress state in the parent component
          setDeployedContract(editionDropAddress);
  
          // Get the contract instance
          const editionDrop = await sdk?.getContract(deployedContract);
          console.log('✅ Successfully deployed editionDrop contract, address:', editionDrop);

          // Get the metadata of the contract
          const metadata = await editionDrop?.metadata.get();
          console.log('✅ editionDrop metadata:', metadata);

          // TODO: Lazy mint the NFT
          // const lazyMintNft = async ()=> {
          //   const { mutateAsync, isLoading, error } = useContractWrite(editionDrop, "lazyMint");
          // };
  
          // Show toast notification for successful verification
          toast({
            title: '🎉 Done!',
            description: `Successfully deployed editionDrop contract at ${editionDropAddress}`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        } catch (error) {
          console.log('Failed to deploy editionDrop contract', error);
        }
      };
  
      // Call the deployEditionDrop function when the component mounts
      deployEditionDrop();
    }, [sdk, toast]);

  } else {
    console.log('address not found')
    toast({
      title: '🙁 You Must Sign In',
      description: `Please sign in to deploy the editionDrop contract`,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  }
};

export default useDeployEditionDrop;