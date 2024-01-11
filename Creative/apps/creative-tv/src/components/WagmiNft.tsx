import { Box, Button, Flex, IconButton, Stack, Text, useToast } from '@chakra-ui/react'
import { useAsset, useUpdateAsset } from '@livepeer/react'
import { ConnectWallet, MediaRenderer, ThirdwebSDK, useAddress, useContract, useMetadata, useSigner } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
// import { CREATIVE_ADDRESS, NEXT_PUBLIC_THIRDWEB_API_KEY } from 'utils/config'
import { ethers } from 'ethers'
import { HiOutlineClipboardCopy } from 'react-icons/hi'
import { removeUnderScore } from 'utils/formatString'
import { windowStorage } from '../utils'
import { CREATIVE_ADDRESS, THIRDWEB_API_KEY } from '../utils/config'
import { AssetData } from './CreateAndViewAsset'
import { SetClaimConditions } from './SetClaimConditions'
import { ErrorBoundary } from './hoc/ErrorBoundary'

const edContractAddress = 'EditionDrop::ContractAddress'

interface WagmiNftProps {
  assetId: string
  assetData: AssetData
}

interface NFTCollection {
  image_url: string
}
type ContractMetaData = {
  name: string
  description: string
  image: string
  app_uri: string
  seller_fee_basis_points: number
  fee_recipient: string
  merkle: Record<any, any>
  symbol: string
  [idx: string]: any
}
const WagmiNft = (props: WagmiNftProps): JSX.Element => {
  const connectedAddress = useAddress()
  const router = useRouter()
  const signer = useSigner()
  const toast = useToast()
  const [deployError, setDeployError] = useState('')
  const [isDeploying, setIsDeploying] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [lazyMintTxStatus, setLazyMintTxStatus] = useState<number | undefined>(0)
  const [isClaimConditionsSet, setClaimConditions] = useState<boolean | undefined>(false)
  const [lazyMintTxHash, setLazyMintTxHash] = useState('')
  const [error, setError] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showMetadataDetails, setMetadataDetails] = useState(false)

  const [deployedContractAddress, setDeployedContractAddress] = useState<string>('')
  const [isContractDeployed, setIsContractDeployed] = useState(false)

  const { contract: nftContract } = useContract(deployedContractAddress)
  const { data: contractMetadata, isLoading } = useMetadata(nftContract)

  /////////////////////////////////////////////
  // TODO: write hooks that prevents page
  // reload after contract is deployed
  /////////////////////////////////////////////
  useEffect(() => {
    const savedContractAddress = windowStorage.get(edContractAddress)
    if (savedContractAddress) {
      console.log('savedContractAddress:', deployedContractAddress)
      setDeployedContractAddress(savedContractAddress)
    }

    return () => {}
  }, [deployedContractAddress])

  // Getting asset and refreshing for the status
  const {
    data: asset,
    error: assetError,
    status: assetStatus,
  } = useAsset({
    assetId: props.assetId,
    refetchInterval: (asset) => (asset?.storage?.status?.phase !== 'ready' ? 5000 : false),
  })

  let notification = (): React.ReactNode => {
    if (assetStatus === 'loading') {
      // Render loading state
      return 'Loading asset data...'
      // console.log('Loading asset data to IPFS...', assetStatus)
    } else if (assetError) {
      // Render error state
      // console.log('Loading asset data to IPFS...', assetError)
      return 'Error fetching asset data'
    }
  }

  // Storing asset to IPFS with metadata by updating the asset
  const {
    mutate: updateAsset,
    status: updateStatus,
    error: updateError,
  } = useUpdateAsset(
    // asset
    assetStatus === 'success'
      ? {
          name: String(asset?.name),
          assetId: String(asset?.id),
          storage: {
            ipfs: true,
            metadata: {
              description: props.assetData.description,
              image: props.assetData.image_url, // clear the default thumbnail
              properties: {
                animation_url: props.assetData.animation_url,
                external_url: props.assetData.external_url,
                image_url: props.assetData.image_url,
                nFTAmountToMint: props.assetData.nFTAmountToMint,
                pricePerNFT: props.assetData.pricePerNFT,
              },
            },
          },
        }
      : undefined
  )

  notification = () => {
    // if (updateStatus === 'loading') {
    //   // Render loading state
    //   return 'Loading asset data to IPFS...'
    // }

    if (updateError) {
      // console.log('Error fetching asset data for IPFS...', updateError)
      // Render error state
      return 'Error fetching asset data for IPFS'
    }
  }

  // Function to deploy the edition drop contract
  const deployNftCollection = async () => {
    // Is there an sdk found and is there a connect wallet address?
    if (!signer || !connectedAddress) return

    const sdk = ThirdwebSDK.fromSigner(signer, 'mumbai', {
      clientId: THIRDWEB_API_KEY,
    })

    // Is there an sdk found?
    if (!sdk) return

    // Is there a name and description?
    if (!props.assetData.description || !asset?.name) return

    try {
      setIsDeploying(true)

      const contractAddress = await sdk.deployer.deployEditionDrop({
        name: asset?.name,
        primary_sale_recipient: connectedAddress,
        app_uri: 'https://tv.creativeplatform.xyz', // Website of your contract dApp
        symbol: 'EPISD', // Symbol of the edition drop
        platform_fee_basis_points: 200,
        platform_fee_recipient: CREATIVE_ADDRESS,
        fee_recipient: connectedAddress,
        seller_fee_basis_points: 300,
        image: props.assetData.image_url || 'Not available',
        description: props.assetData.description,
        trusted_forwarders: [CREATIVE_ADDRESS],
      })

      console.log('Contract deployed', contractAddress)
      windowStorage.set({ key: edContractAddress, value: contractAddress })
      setDeployedContractAddress(contractAddress)

      toast({
        title: 'Contract deployment',
        description: `Deployed successfully at: ${contractAddress}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (err: any) {
      setIsDeploying(false)

      // TODO: send err to ErrorService
      console.log(err.message)
      setDeployError('Contract deployment failed!')
      toast({
        title: 'Contract deployment',
        description: `Deployment failed with: ${err.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const getContractMetaData = () => {
    const data: ContractMetaData = contractMetadata as unknown as any
    let keys: string[], values: string[]

    if (data?.name) {
      keys = Object.keys(data)
      values = Object.values(data)

      return keys.map((k, i) => (
        <div key={i}>
          <p>
            <span style={{ fontWeight: '700' }}>{removeUnderScore(k)}: </span>
            <span>{typeof values[i] === 'string' ? values[i] : JSON.stringify(values[i])}</span>
          </p>
        </div>
      ))
    }
  }

  // Copy string to clipboard
  const handleCopyString = () => {
    navigator.clipboard.writeText(lazyMintTxHash ?? '')
    console.log('TxHash copied:', lazyMintTxHash)
    toast({
      title: 'TxHash Copied',
      description: `Successfully copied ${lazyMintTxHash}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  // lazyMint nft - uploads and creates the NFTs on chain
  const lazyMintNFT = async () => {
    try {
      setIsMinting(true)

      console.log('nftAmount: %s, nftCID: %s', ethers.BigNumber.from(props.assetData.nFTAmountToMint), asset?.storage?.ipfs?.nftMetadata?.cid)
      // console.log('pricePerNNft: %s', asset?.storage?.ipfs?.spec?.nftMetadata.properties.pricePerNFT as any)

      // const lazyMintNftTx = await nftContract?.call('lazyMint', [
      //   ethers.BigNumber.from(props.assetData.nFTAmountToMint),
      //   asset?.storage?.ipfs?.nftMetadata?.cid,
      //   '0x0',
      // ])

      //  if (!lazyMintNftTx.receipt) {
      //   setIsMinting(false)
      // } else {
      //   setLazyMintTxStatus(lazyMintNftTx.receipt.status)
      //   setLazyMintTxHash(lazyMintNftTx.receipt.transactionHash)
      // }
      // console.log('[Minted: tx.receipt] ', lazyMintNftTx.receipt)

      //  toast({
      //   title: 'Lazy Minting',
      //   description: `Minting was successfully with txHash: ${lazyMintNftTx.receipt.transactionHash}`,
      //   status: 'success',
      //   duration: 5000,
      //   isClosable: true,
      // })

      // TODO: remove after debugging
      /////////////////////////////////
      // generate metadata object
      ///////////////////////////

      // const arr = []
      // for(let i = 0; i < props.assetData.nFTAmountToMint!; i ++) {
      //     arr.push()
      // }

      const nftMetadata = [
        {
          name: 'Your Collection #1',
          description: 'Remember to replace this description',
          image: 'ipfs://NewUriToReplace/1.png',
          attributes: [
            {
              trait_type: 'Background',
              value: 'Black',
            },
            {
              trait_type: 'Eyeball',
              value: 'White',
            },
            {
              trait_type: 'Eye color',
              value: 'Yellow',
            },
            {
              trait_type: 'Iris',
              value: 'Medium',
            },
            {
              trait_type: 'Shine',
              value: 'Shapes',
            },
            {
              trait_type: 'Bottom lid',
              value: 'Middle',
            },
            {
              trait_type: 'Top lid',
              value: 'High',
            },
          ],
        },
        {
          name: 'Your Collection #2',
          description: 'Remember to replace this description',
          image: 'ipfs://NewUriToReplace/2.png',
          attributes: [
            {
              trait_type: 'Background',
              value: 'Black',
            },
            {
              trait_type: 'Eyeball',
              value: 'White',
            },
            {
              trait_type: 'Eye color',
              value: 'Red',
            },
            {
              trait_type: 'Iris',
              value: 'Small',
            },
            {
              trait_type: 'Shine',
              value: 'Shapes',
            },
            {
              trait_type: 'Bottom lid',
              value: 'Low',
            },
            {
              trait_type: 'Top lid',
              value: 'Middle',
            },
          ],
        },
      ]

      let receipt: ethers.providers.TransactionReceipt
      const lazyMint = await nftContract?.erc1155.lazyMint(nftMetadata)

      if (lazyMint && lazyMint.length) {
        receipt = lazyMint[0].receipt
        setLazyMintTxStatus(receipt!.status)
        setLazyMintTxHash(receipt.transactionHash)

        console.log('[Minted: tx.receipt] ', receipt)
      } else {
        setIsMinting(false)
      }

      console.log('[Minted: tx.receipt] ', 'receipt')
      toast({
        title: 'Lazy Minting',
        description: `Minting was successfully with txHash: ${lazyMintTxHash}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      router.replace({
        pathname: `profile/${encodeURIComponent(connectedAddress as any)}`,
        hash: 'uploadedVideo',
        // query: {
        //   isClaimConditionSet: claimConditions?.receipt.status,
        //   nftContractAddress: props.nftContractAddress,
        //   contractMetadata: props.contractMetadata as any,
        //   nftMetadata: props.nftMetadata as any,
        // },
      })
    } catch (err: any) {
      console.error(err)
      setIsMinting(false)
      setError(err.message)

      toast({
        status: 'error',
        title: 'NFT not minted',
        description: err.message,
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleSetClaimCondition = async (formData: any): Promise<boolean | undefined> => {
    const tokenId = 0
    console.log('formData::setClaimCondition: ', formData)
    // const [state, setState] = useState({
    //   price: props.nftMetadata['properties']['pricePerNFT'], // The price of the token in the currency specified above
    //   currencyAddress: '', // The address of the currency you want users to pay in
    //   phaseName: '', // The name of the phase
    //   maxClaimablePerWallet: '', // The maximum number of tokens a wallet can claim
    //   maxClaimableSupply: '', // The total number of tokens that can be claimed in this phase
    //   startTime: '', // When the phase starts (i.e. when users can start claiming tokens)
    //   waitInSeconds: '',
    // })

    try {
      const claimConditions = await nftContract?.erc1155.claimConditions.set(tokenId, [
        {
          startTime: formData.startTime, // When the phase starts (i.e. when users can start claiming tokens)
          maxClaimableSupply: formData.maxClaimableSupply, // limit how many mints for this presale
          price: formData.price, // presale price
          currencyAddress: formData.currencyAddress, // The address of the currency you want users to pay in
          maxClaimablePerWallet: formData.maxClaimablePerWallet, // The maximum number of tokens a wallet can claim
          metadata: {
            name: formData.phaseName, // Name of the sale's phase
          },
          waitInSeconds: formData.waitInSeconds, // How long a buyer waits before another purchase is possible
        },
      ])

      console.log('claimConditions tx: ', claimConditions?.receipt)
      setClaimConditions(Boolean(claimConditions?.receipt.status))
      toast({
        title: 'Set Claim Conditions',
        description: `Status: ${claimConditions?.receipt.status}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      return Number(claimConditions?.receipt.status) > 0
    } catch (err) {
      console.log('claimConditions txError: ', err)
      setClaimConditions(false)
      toast({
        title: 'Set Claim Conditions',
        description: `Status: 0`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  return (
    <Box className="address-mint" minH={'600'}>
      {!connectedAddress && (
        <ConnectWallet
          btnTitle={'Sign In'}
          className="signIn-button"
          style={{
            marginBottom: '24px',
            margin: '48px 0',
            fontWeight: '600',
          }}
        />
      )}

      {notification ? (
        <Text as={'h3'} my={8} style={{ fontWeight: '600', fontSize: 24 }}>
          {notification()}
        </Text>
      ) : null}

      {connectedAddress && props.assetId && (
        <>
          {asset?.status?.phase === 'ready' && asset?.storage?.status?.phase !== 'ready' ? (
            <>
              <Stack spacing="20px" my={12} style={{ border: '1px solid #a4a4a4', padding: 24 }}>
                <Text my={4} style={{ fontWeight: '600', fontSize: 24 }}>
                  Your asset is ready to be saved to IPFS.
                </Text>
                <Button
                  my={8}
                  w={'160px'}
                  className="upload-button"
                  bgColor="#EC407A"
                  disabled={updateStatus === 'loading'}
                  _hover={{
                    transform: asset?.storage?.status?.phase === 'processing' ? '' : 'scale(1.02)',
                    cursor: asset?.storage?.status?.phase === 'processing' ? 'progress' : 'pointer',
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    updateAsset?.() // Function to upload asset to IPFS
                  }}>
                  {updateStatus === 'loading' ? 'Saving to IPFS...' : 'Save to IPFS'}{' '}
                </Button>
              </Stack>
            </>
          ) : null}

          {asset?.storage?.ipfs?.cid && (
            <Stack spacing="20px" my={12} style={{ border: '1px solid #aeaeae', padding: 24 }}>
              <Text as={'h4'} my={2} style={{ fontWeight: '500', fontSize: 22 }}>
                Congrats, your asset was uploaded to IPFS.
              </Text>

              <Button
                width={160}
                className="show-details-button"
                my={4}
                onClick={() => setShowDetails(!showDetails)}
                style={{ backgroundColor: '#EC407A' }}>
                {showDetails ? 'Hide ' : 'Show '}Details
              </Button>

              <Box my={8} style={{ display: showDetails ? 'block' : 'none' }}>
                <Text as="h4" mb={8} style={{ fontWeight: '700', fontSize: 22 }}>
                  Asset details:
                </Text>
                <MediaRenderer src={`${asset?.storage?.ipfs?.url}`} width="100%" alt={`${asset.name}`} />
                <Box style={{ lineHeight: 2.75 }}>
                  <Text>
                    Asset Name: <span style={{ fontWeight: '700' }}>{asset?.name}</span>{' '}
                  </Text>
                  <Text>
                    Metadata CID: <span style={{ fontWeight: '700' }}>{asset?.storage?.ipfs?.nftMetadata?.url ?? 'None'}</span>
                  </Text>
                </Box>
              </Box>
            </Stack>
          )}

          <Box my={16} style={{ border: '1px solid #aeaeae', padding: 24 }}>
            {!nftContract?.getAddress() && asset?.storage?.ipfs?.cid && (
              <ErrorBoundary fallback={<p>Failed to load...</p>}>
                <Text style={{ fontWeight: '500', fontSize: 20, marginBottom: 4 }}>Now deploy the contract for your uploaded Asset</Text>
                <br />
                <Button
                  className="deploy-button"
                  my={4}
                  // as={motion.div}
                  bgColor="#EC407A"
                  isLoading={isDeploying}
                  _hover={{ transform: isDeploying ? '' : 'scale(1.02)', cursor: isDeploying ? 'progress' : 'pointer' }}
                  onClick={(e) => {
                    e.preventDefault()
                    deployNftCollection?.() // Function to deploy edition drop contract
                  }}>
                  {isDeploying ? 'Deploying Contract...' : 'Deploy Contract'}
                </Button>

                {!isDeploying && <span style={{ color: '#c1c1c1', fontWeight: 700 }}>{deployError}</span>}
              </ErrorBoundary>
            )}

            {isContractDeployed && asset?.storage?.ipfs?.nftMetadata?.cid && nftContract?.getAddress() && (
              <>
                <Stack spacing="20px">
                  <Text as={'h4'} my={2} style={{ fontWeight: '500', fontSize: 22 }}>
                    Contract deployed succesfully!
                  </Text>

                  <Button
                    className="show-details-button"
                    onClick={() => {
                      setMetadataDetails(!showMetadataDetails)
                    }}
                    style={{ maxWidth: 240, margin: '12px 0', backgroundColor: '#EC407A', marginTop: 4 }}>
                    {showMetadataDetails ? 'Hide ' : 'Show '}Contract MetaData
                  </Button>

                  <Box my={8} style={{ display: showMetadataDetails ? 'block' : 'none' }}>
                    <Flex direction={'column'} style={{ lineHeight: 2.75 }}>
                      <Text>
                        <span style={{ fontWeight: '700' }}>Contract Address: </span>
                        <span>{nftContract.getAddress()}</span>
                      </Text>
                      {getContractMetaData()}
                    </Flex>
                  </Box>
                </Stack>
              </>
            )}
          </Box>

          {isContractDeployed && asset?.storage?.ipfs?.nftMetadata?.cid && nftContract?.getAddress() && (
            <Stack spacing="20px" my={12} style={{ border: '1px solid', padding: 24 }}>
              <Text as={'h4'} my={2} style={{ fontWeight: '500', fontSize: 22 }}>
                {lazyMintTxStatus ? 'NFT was lazy minted successfully!' : 'Time to lazy mint your NFTs!'}
              </Text>

              {lazyMintTxStatus ? (
                <p style={{ fontWeight: '500' }}>
                  TxHash:{' '}
                  <span style={{ cursor: 'pointer' }} onClick={handleCopyString}>
                    {lazyMintTxHash}
                  </span>
                  <IconButton aria-label="Copy to clipboard" icon={<HiOutlineClipboardCopy />} onClick={handleCopyString} />
                </p>
              ) : (
                <Button
                  onClick={lazyMintNFT}
                  isLoading={isMinting}
                  _hover={{ cursor: isMinting ? 'progress' : 'pointer' }}
                  style={{ width: 160, margin: '12px 0', backgroundColor: '#EC407A' }}>
                  {isMinting ? 'Lazy Minting...' : 'Lazy Mint NFT'}
                </Button>
              )}
            </Stack>
          )}

          {isContractDeployed && asset?.storage?.ipfs?.nftMetadata?.cid && nftContract?.getAddress() && (
            <Stack spacing="20px" my={12} style={{ border: '1px solid #aeaeae', padding: 24 }}>
              {isClaimConditionsSet ? (
                <Text as={'h4'} my={2} style={{ fontWeight: '500', fontSize: 22 }}>
                  Claim conditions was successfully set!
                </Text>
              ) : (
                <SetClaimConditions handleSetClaimCondition={handleSetClaimCondition} nftMetadata={asset?.storage?.ipfs?.spec?.nftMetadata as any} />
              )}
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}

export default WagmiNft
