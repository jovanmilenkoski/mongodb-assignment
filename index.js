const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'mydaytrip';

const originalLocationId = 'c8cbd117-5793-4799-9958-68232c2fac55';
const destinationLocationId = '4cf0e7a4-8443-40c9-bbf3-bfe253a3c631';

const query = [
    // ======================================================================================================================================
    {
        $facet: {
            routes: [
                {
                    $match: {
                        originLocationId: originalLocationId,
                        destinationLocationId: destinationLocationId
                    }
                }
            ],
            returnRoutes: [
                {
                    $match: {
                        originLocationId: destinationLocationId,
                        destinationLocationId: originalLocationId
                    }
                }
            ]
        },
    },
    // ======================================================================================================================================
    {
        $project: {
            originalRouteId: "$routes._id", // We need this to ensure we don't return the original route as similar
            similarRoutes: {
                // Will clear out duplicates
                $setUnion: [
                    '$routes.similarRoutes',
                    '$returnRoutes.similarRoutesInOtherDirection'
                ]
            }
        }
    },
    // ======================================================================================================================================
    {
        $project: {
            originalRouteId: {
                $arrayElemAt: ['$originalRouteId', 0]
            },
            similarRoutes: {
                $arrayElemAt: ['$similarRoutes', 0]
            }
        }
    },
    // ======================================================================================================================================
    {
        $unwind: {
            path: '$similarRoutes'
        }
    },
    // ======================================================================================================================================
    {
        $lookup: {
            from: 'routes',
            localField: 'similarRoutes.routeId',
            foreignField: '_id',
            as: 'similarRoutes'
        }
    },
    // ======================================================================================================================================
    {
        $replaceRoot: {
            newRoot: {
                $mergeObjects: [{ originalRouteId: "$originalRouteId" }, { $arrayElemAt: ['$similarRoutes', 0] }]
            }
        }
    },
    // ======================================================================================================================================
    {
        $match: {
            $expr: {
                $and: [
                    { $ne: ["$_id", "$originalRouteId"] },
                    { $eq: ["$isPublic", true] },
                    { $eq: ["$isAvailable", true] },
                ]
            }
        }
    },
    // ======================================================================================================================================
    {
        $lookup: {
            from: 'locations',
            localField: 'locations.locationId',
            foreignField: '_id',
            as: 'fullLocations'
        }
    },
    // ======================================================================================================================================
    {
        $lookup: {
            from: 'locations',
            localField: 'originLocationId',
            foreignField: '_id',
            as: 'origin'
        }
    },
    // ======================================================================================================================================
    {
        $lookup: {
            from: 'locations',
            localField: 'destinationLocationId',
            foreignField: '_id',
            as: 'destination'
        }
    },
    // ======================================================================================================================================
    {
        $lookup: {
            from: 'countries',
            localField: 'countryId',
            foreignField: '_id',
            as: 'country'
        }
    },
    // ======================================================================================================================================
    {
        $project: {
            _id: 1,
            locations: {
                $map: {
                    input: {
                        $filter: {
                            input: "$fullLocations",
                            as: 'location',
                            cond: { $eq: ["$$location.isLive", true] }
                        }
                    },
                    in: {
                        order: {
                            $arrayElemAt: [
                                '$locations.order',
                                {
                                    $indexOfArray: ['$locations.locationId', '$$this._id']
                                }
                            ]
                        },
                        location: {
                            _id: '$$this._id',
                            name: '$$this.name',
                            title: '$$this.title'
                        }
                    }
                },
            },
            origin: {
                $arrayElemAt: ['$origin', 0]
            },
            destination: {
                $arrayElemAt: ['$destination', 0]
            },
            country: {
                $arrayElemAt: ['$country', 0]
            },
            isBidirectional: 1,
            isPublic: 1,
            isAvailable: 1
        }
    },
    // ======================================================================================================================================
    {
        $project: {
            'origin.isLive': 0,
            'destination.isLive': 0
        }
    }
    // ======================================================================================================================================
]

MongoClient.connect(url, async (err, client) => {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);
    const result = await db.collection('routes').aggregate(query).toArray();

    console.log(`Sample: ${JSON.stringify(result[0], null, 4)}\n`);
    console.log(`Results: ${result.length}`);

    client.close();
});