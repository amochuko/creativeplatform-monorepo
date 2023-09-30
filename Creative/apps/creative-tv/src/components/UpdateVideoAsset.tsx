import { Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink } from '@chakra-ui/react'
import { useRouter } from 'next/router'
import React, { ReactNode } from 'react'
import { LivepeerConfig } from '@livepeer/react'
import { useLivepeerClient } from '../hooks/useLivepeerClient'
import { Emoji } from 'ui'

interface HeaderProps {
  children: ReactNode
}

const UpdateVideoAsset = ({ children }: HeaderProps): JSX.Element => {
  const router = useRouter()
  return (
    <Box>
      <Breadcrumb mt={10}>
        <BreadcrumbItem>
          <BreadcrumbLink onClick={() => router.push('/')}><Emoji symbol='🏠' label='home'/>  Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage className="active-crumb">
          <BreadcrumbLink href="#">Update Video Assets</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      <LivepeerConfig client={useLivepeerClient}>{}</LivepeerConfig>
    </Box>
  )
}
export default UpdateVideoAsset
