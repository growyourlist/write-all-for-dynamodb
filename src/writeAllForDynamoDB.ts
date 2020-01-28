import { DynamoDB } from "aws-sdk";

const batchSize = 25;
const maxRetries = 100;

const mergeConsumedCapacity = (
  capacityA?: DynamoDB.DocumentClient.ConsumedCapacityMultiple,
  capacityB?: DynamoDB.DocumentClient.ConsumedCapacityMultiple
): DynamoDB.DocumentClient.ConsumedCapacityMultiple | null => {
  if (!capacityA && !capacityB) {
    return null;
  }
  const cA: DynamoDB.DocumentClient.ConsumedCapacityMultiple = capacityA
    ? capacityA
    : [];
  const cB: DynamoDB.DocumentClient.ConsumedCapacityMultiple = capacityB
    ? capacityB
    : [];
  return cA.concat(cB);
};

const mergeItemCollectionMetrics = (
  metricsA?: DynamoDB.DocumentClient.ItemCollectionMetricsPerTable,
  metricsB?: DynamoDB.DocumentClient.ItemCollectionMetricsPerTable
): DynamoDB.DocumentClient.ItemCollectionMetricsPerTable | null => {
  if (!metricsA && !metricsB) {
    return null;
  }
  const mA: DynamoDB.DocumentClient.ItemCollectionMetricsPerTable = metricsA
    ? Object.assign({}, metricsA)
    : {};
  const mB: DynamoDB.DocumentClient.ItemCollectionMetricsPerTable = metricsB
    ? Object.assign({}, metricsB)
    : {};
  if (metricsA && !metricsB) {
    return mA;
  }
  if (!metricsA || metricsB) {
    return mB;
  }
  Object.keys(mA).forEach(tableName => {
    if (mB[tableName]) {
      metricsB[tableName].forEach(item => {
        mA[tableName].push(item);
      });
      delete metricsB[tableName];
    }
  });
  return Object.assign({}, mA, mB);
};

const mergeResults = (
  resultA: DynamoDB.DocumentClient.BatchWriteItemOutput,
  resultB: DynamoDB.DocumentClient.BatchWriteItemOutput
): DynamoDB.DocumentClient.BatchWriteItemOutput => {
  const merged: DynamoDB.DocumentClient.BatchWriteItemOutput = {
    // This function is only called when all items processed
    UnprocessedItems: {}
  };
  if (resultA.ItemCollectionMetrics || resultB.ItemCollectionMetrics) {
    merged.ItemCollectionMetrics = mergeItemCollectionMetrics(
      resultA.ItemCollectionMetrics,
      resultB.ItemCollectionMetrics
    );
  }
  if (resultA.ConsumedCapacity || resultB.ConsumedCapacity) {
    merged.ConsumedCapacity = mergeConsumedCapacity(
      resultA.ConsumedCapacity,
      resultB.ConsumedCapacity
    );
  }
  return merged;
};

const processBatchUntilDone = async (
  dynamodb: DynamoDB.DocumentClient,
  batch: DynamoDB.DocumentClient.BatchWriteItemInput,
  attempts: number = 1,
): Promise<DynamoDB.DocumentClient.BatchGetItemOutput> => {
  let result: DynamoDB.DocumentClient.BatchWriteItemOutput = {};
  let targetBatch: DynamoDB.DocumentClient.BatchWriteItemInput = batch;
  do {
    try {
      let tempResult: DynamoDB.DocumentClient.BatchWriteItemOutput = 
        await dynamodb.batchWrite(targetBatch).promise();
      if (Object.keys(tempResult.UnprocessedItems).length) {
        targetBatch = {
          RequestItems: tempResult.UnprocessedItems
        }
      }
      else {
        targetBatch = null
      }
      result = mergeResults(result, tempResult);
    }
    catch (err) {
      if (!err.retryable) {
        throw err
      }
      if (attempts >= maxRetries) {
        throw err
      }
      return await processBatchUntilDone(dynamodb, targetBatch, attempts + 1)
    }
	} while (targetBatch);
	return result
};

export const writeAllForDynamoDB = async (
  dynamodb: DynamoDB.DocumentClient,
  params: DynamoDB.DocumentClient.BatchWriteItemInput
): Promise<DynamoDB.DocumentClient.BatchWriteItemOutput> => {
  const tableNames = Object.keys(params.RequestItems);
  let fullResult = {};
  for (let i = 0; i < tableNames.length; i++) {
    const TableName = tableNames[i];
    const tableRequests = params.RequestItems[TableName];
    const batches: DynamoDB.DocumentClient.WriteRequests[] = [];
    let currentBatch: DynamoDB.DocumentClient.WriteRequests = [];
    tableRequests.forEach(request => {
      if (currentBatch.length === batchSize) {
        batches.unshift(currentBatch);
        currentBatch = [];
      }
      currentBatch.push(request);
    });
    batches.unshift(currentBatch);
    let targetBatch = batches.pop();
    while (targetBatch) {
			const result = await processBatchUntilDone(dynamodb, {
        RequestItems: {
          [TableName]: targetBatch
        }
      });
			fullResult = mergeResults(fullResult, result);
      targetBatch = batches.pop();
		}
	}
	return fullResult
}
