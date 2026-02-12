// Test wallet connection
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

async function testWalletConnection() {
  console.log('🔐 Testing Wallet Connection...\n');

  const privateKey = process.env.WALLET_PRIVATE_KEY;
  const walletAddress = process.env.WALLET_ADDRESS;

  if (!privateKey || !walletAddress) {
    console.error('❌ Error: Wallet not configured!');
    console.error('   Run: ./setup-wallet.sh');
    process.exit(1);
  }

  try {
    // Create wallet instance
    const wallet = new ethers.Wallet(privateKey);
    
    console.log('✅ Wallet loaded successfully!');
    console.log(`   Address: ${wallet.address}`);
    
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      console.error('❌ Warning: Wallet address mismatch!');
      console.error(`   Expected: ${walletAddress}`);
      console.error(`   Got: ${wallet.address}`);
      process.exit(1);
    }
    
    console.log('✅ Address verification passed!');
    
    // Connect to Polygon
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const connectedWallet = wallet.connect(provider);
    
    console.log('\n📊 Checking wallet balance on Polygon...');
    
    const maticBalance = await provider.getBalance(wallet.address);
    const maticBalanceFormatted = ethers.formatEther(maticBalance);
    
    console.log(`   MATIC Balance: ${maticBalanceFormatted} MATIC`);
    
    // Check USDC balance (Polygon USDC address)
    const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    const usdcAbi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ];
    
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const usdcDecimals = await usdcContract.decimals();
    const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, usdcDecimals);
    
    console.log(`   USDC Balance: $${usdcBalanceFormatted} USDC`);
    
    console.log('\n🎉 Wallet connection test successful!');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('   1. Make sure you have USDC on Polygon');
    console.log('   2. Keep some MATIC for gas fees');
    console.log('   3. Run: npm run build');
    console.log('   4. Run: npm start (monitor mode first!)');
    console.log('   5. Monitor for 24-48 hours before approving trades');
    
  } catch (error: any) {
    console.error('❌ Error testing wallet connection:');
    console.error(error.message);
    process.exit(1);
  }
}

testWalletConnection();
