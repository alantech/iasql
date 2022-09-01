import {objectsAreSame, policiesAreSame} from "../../src/services/aws-diff";

jest.setTimeout(30000);

describe("policiesAreSame", () => {
    describe("when cloud and DB policies are exactly the same", () => {
        it("should return true", () => {
            // Arrange
            const policy1 = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: "s3:GetObject",
                        Resource: "arn:aws:s3:::mybucket/*",
                    },
                ],
            };

            const policy2 = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: "s3:GetObject",
                        Resource: "arn:aws:s3:::mybucket/*",
                    },
                ],
            };

            // Act
            const result = policiesAreSame(policy1, policy2);

            // Assert
            expect(result).toBe(true);
        });
    })

    describe("when the policies have same meaning but different structure", () => {
        describe("when one policy has \"Action\" as single-element array of string, instead of string", () => {
            it("should return true", () => {
                // Arrange
                const dbPolicy = {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Action: "s3:GetObject", // <-- string
                            Resource: "arn:aws:s3:::mybucket/*",
                        },
                    ],
                };

                const cloudPolicy = {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Action: ["s3:GetObject"],  // <-- single-element array of strings
                            Resource: "arn:aws:s3:::mybucket/*",
                        },
                    ],
                };

                // Act
                const result = policiesAreSame(dbPolicy, cloudPolicy);

                // Assert
                expect(result).toBe(true);
            });
        })

        describe("when one policy has \"Statement\" as single-element array of object, instead of object", () => {
            it("should return true", () => {
                // Arrange
                const dbPolicy = {
                    Version: "2012-10-17",
                    Statement: [  // <-- single-element array of object
                        {
                            Effect: "Allow",
                            Action: "s3:GetObject",
                            Resource: "arn:aws:s3:::mybucket/*",
                        },
                    ],
                };

                const cloudPolicy = {
                    Version: "2012-10-17",
                    Statement: { // <-- single-element object
                        Effect: "Allow",
                        Action: ["s3:GetObject"],
                        Resource: "arn:aws:s3:::mybucket/*",
                    },
                };

                // Act
                const result = policiesAreSame(dbPolicy, cloudPolicy);

                // Assert
                expect(result).toBe(true);
            });
        })

        describe("when both policies have \"Action\" as array of strings but reordered", () => {
            it("should return true", () => {
                // Arrange
                const dbPolicy = {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
                            Resource: "arn:aws:s3:::mybucket/*",
                        },
                    ],
                };

                const cloudPolicy = {
                    Version: "2012-10-17",
                    Statement: {
                        Effect: "Allow",
                        Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], // <-- reordered
                        Resource: "arn:aws:s3:::mybucket/*",
                    },
                };
                // Act
                const result = policiesAreSame(dbPolicy, cloudPolicy);

                // Assert
                expect(result).toBe(true);
            });
        })

        describe("when both policies have their [nested] keys reordered", () => {
            it("should return true", () => {
                // Arrange
                const dbPolicy = {
                    Statement: [
                        {
                            Resource: "arn:aws:s3:::mybucket/*",
                            Effect: "Allow",
                            Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
                        },
                    ],
                    Version: "2012-10-17",
                    Sid: "some_sid",
                };

                const cloudPolicy = {
                    Sid: "some_sid",
                    Version: "2012-10-17",
                    Statement: {
                        Effect: "Allow",
                        Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                        Resource: "arn:aws:s3:::mybucket/*", // <-- different order
                    },
                };

                // Act
                const result = policiesAreSame(dbPolicy, cloudPolicy);

                // Assert
                expect(result).toBe(true);
            });
        })
    })

    describe("when the policies have different meaning", () => {
        it('should return false', () => {
            const dbPolicy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: "s3:GetObject",
                        Resource: "arn:aws:s3:::mybucket/*",
                    }
                ],
                Principal: {
                    AWS: "arn:aws:iam::123456789012:root"
                }
            }

            const cloudPolicy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: "s3:GetObject",
                        Resource: "arn:aws:s3:::mybucket/*",
                    }
                ],
                Principal: {
                    Canonical: "arn:aws:iam::123456789012:root" // <-- different
                }
            }

            // Act
            const result = policiesAreSame(dbPolicy, cloudPolicy);

            // Assert
            expect(result).toBe(false);
        });
    })
})

describe("objectsAreSame", () => {
    // RDS DB Parmaters example
    describe("when it compares 2 different arrays of objects", () => {
        it('should return false', () => {
            const arr1 = [
                {
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    "ParameterName": "allow-suspicious-udfs"
                },
                {
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "dynamic",
                    "ApplyMethod": "pending-reboot",
                    "Description": "A global user variable for user to disable hash join. When it is on, hash join is disabled by default, and customer can set it on per session.",
                    "IsModifiable": true,
                    "AllowedValues": "0,1",
                    "ParameterName": "aurora_disable_hash_join",
                    "MinimumEngineVersion": "5.7.mysql_aurora.2.06.0"
                }]

            const arr2 = [
                {
                    "Source": "different-source", // <-- different
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    "ParameterName": "allow-suspicious-udfs"
                },
                {
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "dynamic",
                    "ApplyMethod": "pending-reboot",
                    "Description": "A global user variable for user to disable hash join. When it is on, hash join is disabled by default, and customer can set it on per session.",
                    "IsModifiable": true,
                    "AllowedValues": "0,1",
                    "ParameterName": "aurora_disable_hash_join",
                    "MinimumEngineVersion": "5.7.mysql_aurora.2.06.0"
                }
                ]

            // Act
            const result = objectsAreSame(arr1, arr2);

            // Assert
            expect(result).toBe(false);
        });
    })

    describe("when it compares one single-element array of object, and the same object", () => {
        it('should return false', () => {
            const obj1 = {
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    "ParameterName": "allow-suspicious-udfs"
                };

            const obj2 = [{
                "Source": "engine-default",
                "DataType": "boolean",
                "ApplyType": "static",
                "ApplyMethod": "pending-reboot",
                "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                "IsModifiable": false,
                "AllowedValues": "0,1",
                "ParameterName": "allow-suspicious-udfs"
            }]

            // Act
            const result = objectsAreSame(obj1, obj2);

            // Assert
            expect(result).toBe(false);
        });
    })

    describe("when it compares the same array of objects", () => {
        describe("when some objects contain '[key] : undefined' and others don't contain [key] at all", () => {
            it('should return true', () => {
                const arr1 = [{
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    "ParameterName": undefined // <-- undefined
                }];

                const arr2 = [{
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    // No ParameterName key
                }]

                // Act
                const result = objectsAreSame(arr1, arr2);

                // Assert
                expect(result).toBe(true);
            });
        });
    })

    describe("when it compares two same JSON objects", () => {
        describe("when one object contains '[key] : undefined' and the other doesn't contain [key] at all", () => {
            it('should return true', () => {
                const obj1 = {
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    "ParameterName": undefined // <-- undefined
                };

                const obj2 = {
                    "Source": "engine-default",
                    "DataType": "boolean",
                    "ApplyType": "static",
                    "ApplyMethod": "pending-reboot",
                    "Description": "Controls whether user-defined functions that have only an xxx symbol for the main function can be loaded",
                    "IsModifiable": false,
                    "AllowedValues": "0,1",
                    // No ParameterName key
                }

                // Act
                const result = objectsAreSame(obj1, obj2);

                // Assert
                expect(result).toBe(true);
            });
        });
    })
})
