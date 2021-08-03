const ethers = require('ethers');
const FactoryAbi = require('./contracts/RAIR_Token_Factory.json').abi;
const TokenAbi = require('./contracts/RAIR_ERC721.json').abi;
const MinterAbi = require('./contracts/Minter_Marketplace.json').abi;

const main = async () => {
	// Connect to the Binance Testnet
	binanceTestnetProvider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545/', {
		chainId: 97, symbol: 'BNB', name: 'Binance Testnet'
	})
	console.log('Connected to Binance Testnet');

	// These connections don't have an address associated, so they can read but can't write to the blockchain
	let factoryInstance = await new ethers.Contract('0x58B81fE7D18ED2296A9E814c768d28dA3BCC94F9', FactoryAbi, binanceTestnetProvider);
	let minterInstance = await new ethers.Contract('0xe9245a462b1B6Dd41075a80748760fa29A597591', MinterAbi, binanceTestnetProvider);

	minterInstance.on('AddedOffer(address,uint256,uint256,uint256)', (contractAddress, tokensAllowed, individualPrice, catalogIndex) => {
		console.log(`Minter Marketplace: Created a new offer ${catalogIndex} (from ${contractAddress}), ${tokensAllowed} tokens for ${individualPrice} WEI each`);
	});
	minterInstance.on('AppendedRange(address,uint256,uint256,uint256,uint256,uint256,uint256,string)', (contractAddress, productIndex, offerIndex, rangeIndex, startingToken, endingToken, priceOfToken, nameOfRange) => {
		console.log(`Minter Marketplace: New range created for contract ${contractAddress} on product ${productIndex} (offer #${offerIndex} on the marketplace) as range #${rangeIndex}: ${nameOfRange}, starting from ${startingToken} to ${endingToken} at ${priceOfToken} each`);
	})
	minterInstance.on('ChangedNodeFee(uint16)', (newFee) => {
		console.log(`Minter Marketplace updated the node fee to ${newFee}!`);
	});
	minterInstance.on('ChangedTreasury(address)', (newAddress) => {
		console.log(`Minter Marketplace updated the treasury address to ${newAddress}!`);
	});
	minterInstance.on('ChangedTreasuryFee(address,uint16)', (treasuryAddress, newTreasuryFee) => {
		console.log(`Minter Marketplace updated the treasury (${treasuryAddress}) fee to ${newTreasuryFee}!`);
	});
	minterInstance.on('SoldOut(address,uint256,uint256)', (contractAddress, offerIndex, rangeIndex) => {
		console.log(`Minter Marketplace: Range #${rangeIndex} from offer #${offerIndex} (from ${contractAddress}) is sold out!`);
	});
	minterInstance.on('TokenMinted(address,address,uint256,uint256,uint256)', (ownerAddress, contractAddress, offerIndex, rangeIndex, tokenIndex) => {
		console.log(`Minter Marketplace: ${ownerAddress} minted token #${tokenIndex} from range #${rangeIndex} from offer #${offerIndex} (from ${contractAddress})!`);
	});
	minterInstance.on('UpdatedOffer(address,uint256,uint256,uint256,uint256,string)', (contractAddress, offerIndex, rangeIndex, tokensAllowed, individualPrice, rangeName) => {
		console.log(`Minter Marketplace: Updated the info for range #${rangeIndex} ${rangeName} (from ${contractAddress}, offer #${offerIndex}), ${tokensAllowed} tokens for ${individualPrice} each`);
	});

	let numberOfCreators = await factoryInstance.getCreatorsCount();

	factoryInstance.on('TokensWithdrawn(address,address,uint256)', (recipient, contract, amount) => {
		console.log(`Factory: ${amount} ERC777 tokens from ${contract} were withdrawn by ${recipient}`);
	})
	factoryInstance.on('NewContractDeployed(address,uint256,address)', (owner, newContractCount, newContractAddress) => {
		console.log(`Factory: A new ERC721 contract has been deployed by ${owner}, that makes ${newContractCount} contracts deployed, the new contract is at ${newContractAddress} (We are NOT listening for events in that contract, relaunch the app to listen to the new events!)`);
	})
	factoryInstance.on('NewTokensAccepted(address,uint256)', (tokenAddress, amountNeeded) => {
		console.log(`Factory: New Tokens accepted for deplyment! Now you can pay ${amountNeeded} tokens from ${tokenAddress} to deploy a contract`)
	})
	factoryInstance.on('TokenNoLongerAccepted(address)', (address) => {
		console.log(`Factory: tokens from ${address} are no longer accepted!`);
	})

	console.log(numberOfCreators.toString(), 'addresses have deployed tokens in this factory');
	for (let i = 0; i < numberOfCreators; i++) {
		let creatorAddress = await factoryInstance.creators(i);
		let numberOfTokens = await factoryInstance.getContractCountOf(creatorAddress);
		console.log(creatorAddress, 'has deployed', numberOfTokens.toString(), 'contracts');
		for (let j = 0; j < numberOfTokens; j++) {
			let contractAddress = await factoryInstance.ownerToContracts(creatorAddress, j);
			let tokenInstance = new ethers.Contract(contractAddress, TokenAbi, binanceTestnetProvider);
			// You can view all listen-able events with:
			// console.log(tokenInstance.filters);
			tokenInstance.on('RangeLocked(uint256,uint256,uint256,uint256,string)', (productIndex, startingToken, endingToken, numberRequired, productName) => {
				console.log(`${tokenInstance.address}: locked a range of tokens inside product ${productName} (#${productIndex}), from ${startingToken} to ${endingToken} have been locked until ${numberRequired} tokens get minted!`);
			})
			tokenInstance.on('RangeUnlocked(uint256,uint256,uint256)', (productIndex, startingToken, endingToken) => {
				console.log(`${tokenInstance.address}: The Range of tokens from ${startingToken} to ${endingToken} in product #${productIndex} have been unlocked!`);
			})
			tokenInstance.on("CollectionCreated(uint256,string,uint256)", (index, name, length) => {
				console.log(`${tokenInstance.address}: has a new collection! ID#${index} called ${name} with ${length} copies!`);
			})
			tokenInstance.on("Approval(address,address,uint256)", (approver, approvee, tokenId) => {
				console.log(`${tokenInstance.address}: ${approver} approved ${aprovee} to transfer token #${tokenId}!`);
			})
			tokenInstance.on("ApprovalForAll(address,address,bool)", (approver, aprovee, bool) => {
				console.log(`${tokenInstance.address}: ${approver} ${bool ? 'enabled' : 'disabled'} full approval ${aprovee} to transfer tokens!`);
			})
			tokenInstance.on("CollectionCompleted(uint256,string)", (collectionId, name) => {
				console.log(`${tokenInstance.address} collection #${collectionId} (${name}) ran out of mintable copies!`);
			})
			tokenInstance.on("Transfer(address,address,uint256)", (from, to, tokenId) => {
				console.log(`${tokenInstance.address}: ${from} sent token #${tokenId} to ${to}!`);
			})
			await console.log('Set up listeners for', contractAddress, 'or', await tokenInstance.name());
		}
	}
}

try {
	main()
} catch(err) {
	console.error(err);
}