import test from 'ava'
import * as sinon from 'sinon'
import { MockAWSError } from './mocks/_MockAWSError'

import { writeAllForDynamoDB } from '../writeAllForDynamoDB'
import { MockAWSRequest, MockPromiseResult } from './mocks/_MockAWSRequest'
import { MockAWSResponse } from './mocks/_MockAWSResponse'

test('Simple write works', async t => {
	const AWS = require('aws-sdk')
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => Promise.resolve(Object.assign(
			{
				UnprocessedItems: {}
			} as AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			{ $response: response }
		))
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy);
	const expectedParams = {
		RequestItems: {
			ExampleTableName: [
				{
					PutRequest: {
						Item: {
							testId: 'asdf',
							testData: 'asdf',
						}
					}
				}
			]
		}
	}
	const results = await writeAllForDynamoDB(
		dynamodb,
		expectedParams
	)
	t.deepEqual(
		results,
		{ UnprocessedItems: {} },
		'Should return empty object'
	)
	t.assert(batchWriteSpy.calledOnce, 'batchWrite should only be called once')
})

test('Non-retryable error results in immediate failure', async t => {
	const AWS = require('aws-sdk')
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => Promise.reject(new MockAWSError({
			retryable: false,
		}))
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy)
	await t.throwsAsync(writeAllForDynamoDB(
		dynamodb, {
			RequestItems: {
				ExampleTableName: [
					{
						PutRequest: {
							Item: {
								testId: 'asdf',
								testData: 'asdf',
							}
						}
					}
				]
			}
		}
	))
	t.deepEqual(batchWriteSpy.callCount, 1, 'batchWrite only called once')
})

test('Retryable error results failure after retries', async t => {
	const AWS = require('aws-sdk')
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => Promise.reject(new MockAWSError({
			retryable: true,
		}))
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy)
	await t.throwsAsync(writeAllForDynamoDB(
		dynamodb, {
			RequestItems: {
				ExampleTableName: [
					{
						PutRequest: {
							Item: {
								testId: 'asdf',
								testData: 'asdf',
							}
						}
					}
				]
			}
		}
	))
	t.deepEqual(batchWriteSpy.callCount, 100, 'batchWrite called multiple times')
})

test('Multi-table write', async t => {
	const AWS = require('aws-sdk')
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => Promise.resolve(Object.assign(
			{
				UnprocessedItems: {}
			} as AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			{ $response: response }
		))
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy);
	const expectedParams = {
		RequestItems: {
			ExampleTableName: [
				{
					PutRequest: {
						Item: {
							testId: 'asdf',
							testData: 'asdf',
						}
					}
				}
			],
			ExampleTableName2: [
				{
					PutRequest: {
						Item: {
							testId: 'asdf',
							testData: 'asdf',
						}
					}
				}
			]
		}
	}
	const results = await writeAllForDynamoDB(
		dynamodb,
		expectedParams
	)
	t.deepEqual(results,
		{ UnprocessedItems: {} },
		'Should return empty object'
	)
	t.is(batchWriteSpy.callCount, 2, 'batchWrite should be called twice')
})

const batchSize = 25;
test('Full batch is processed correctly', async t => {
	const AWS = require('aws-sdk')
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => Promise.resolve(Object.assign(
			{
				UnprocessedItems: {}
			} as AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			{ $response: response }
		))
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy);
	const expectedParams = {
		RequestItems: {
			ExampleTableName: [...new Array(batchSize)].map((_: any, i: number) => {
				return {
					PutRequest: {
						Item: {
							testId: `asdf${i}`,
							testData: `asdf${i}`,
						}
					}
				}
			}),
		}
	}
	const results = await writeAllForDynamoDB(
		dynamodb,
		expectedParams
	)
	t.deepEqual(results,
		{ UnprocessedItems: {} },
		'Should return empty object'
	)
	t.true(batchWriteSpy.calledOnce, 'batchWrite should only be called once')
	t.true(
		batchWriteSpy.lastCall.calledWithExactly(expectedParams),
		'batchWrite should have defined params'
	)
})

test('Batches are split when over max size', async t => {
	const AWS = require('aws-sdk')
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => Promise.resolve(Object.assign(
			{
				UnprocessedItems: {}
			} as AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			{ $response: response }
		))
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy);
	const expectedParams = {
		RequestItems: {
			ExampleTableName: [...new Array(batchSize + 1)].map((_: any, i: number) => {
				return {
					PutRequest: {
						Item: {
							testId: `asdf${i}`,
							testData: `asdf${i}`,
						}
					}
				}
			}),
		}
	}
	const results = await writeAllForDynamoDB(
		dynamodb,
		expectedParams
	)
	t.deepEqual(results,
		{ UnprocessedItems: {} },
		'Should return empty object'
	)
	t.true(batchWriteSpy.calledTwice, 'batchWrite should only be called twice')
	t.true(
		batchWriteSpy.firstCall.calledWithExactly({
			RequestItems: {
				ExampleTableName: expectedParams.RequestItems.ExampleTableName.slice(0, 25)
			}
		}),
		'batchWrite first call should have first items'
	)
	t.true(
		batchWriteSpy.lastCall.calledWithExactly({
			RequestItems: {
				ExampleTableName: expectedParams.RequestItems.ExampleTableName.slice(25, 26)
			}
		}),
		'batchWrite last call should have last items'
	)
})

test('When UnprocessedItems are present, they are processed', async t => {
	const AWS = require('aws-sdk')
	let returnUnprocessed = true
	const batchWriteFake = (
		params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput,
		callback?: (
			err: AWS.AWSError,
			data: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput
		) => void
	) => {
		const request = new MockAWSRequest<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const response = new MockAWSResponse<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>();
		const promiseStub: () => Promise<MockPromiseResult<
			AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
			MockAWSError
		>> = () => {
			let UnprocessedItems = {}
			if (returnUnprocessed) {
				returnUnprocessed = false
				UnprocessedItems = params.RequestItems
			}
			return Promise.resolve(Object.assign(
				{
					UnprocessedItems
				} as AWS.DynamoDB.DocumentClient.BatchWriteItemOutput,
				{ $response: response }
			))
		}
		sinon.replace(request, 'promise', promiseStub)
		return request
	}
	const batchWriteSpy = sinon.spy(batchWriteFake)
	const dynamodb = new AWS.DynamoDB.DocumentClient;
	sinon.replace(dynamodb, 'batchWrite', batchWriteSpy);
	const expectedParams = {
		RequestItems: {
			ExampleTableName: [...new Array(batchSize)].map((_: any, i: number) => {
				return {
					PutRequest: {
						Item: {
							testId: `asdf${i}`,
							testData: `asdf${i}`,
						}
					}
				}
			}),
		}
	}
	const results = await writeAllForDynamoDB(
		dynamodb,
		expectedParams
	)
	t.deepEqual(results,
		{ UnprocessedItems: {} },
		'Should return empty object'
	)
	t.true(batchWriteSpy.calledTwice, 'batchWrite should only be called twice')
	t.true(
		batchWriteSpy.firstCall.calledWithExactly({
			RequestItems: {
				ExampleTableName: expectedParams.RequestItems.ExampleTableName
			}
		}),
		'batchWrite first call should attempt to process items'
	)
	t.true(
		batchWriteSpy.lastCall.calledWithExactly({
			RequestItems: {
				ExampleTableName: expectedParams.RequestItems.ExampleTableName
			}
		}),
		'batchWrite last call should attempt to process items again'
	)
})
