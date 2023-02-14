---
slug: subquery-vs-join
title: Subquery vs JOIN
authors: [depombo]
tags: [sql]
---

As a developer, you are probably familiar with the concept of joins in SQL databases. Joins are a powerful tool for combining data from multiple tables, but there are certain situations where subqueries may be a better choice. In this blog post, we will look at the advantages of using subqueries instead of joins in PostgreSQL, and why it may be the better option for your project.

### Improved Performance
One of the biggest advantages of using subqueries is improved performance under most circumstances. Subqueries can be optimized and executed more efficiently than joins, especially when dealing with large amounts of data. In PostgreSQL, subqueries can be executed in parallel, which can significantly improve performance. By breaking down the query into smaller parts, the database can use its indexing and caching mechanisms to optimize the performance of the query. In contrast, joins can be slower and more resource-intensive, especially when dealing with complex queries or large datasets. There is one consideration to see the performance gains outlines. The output of the sub-query itself will not be indexed, so the cardinality of the output needs to be much smaller than the inputs for the performance benefit to occur.

### Better Readability
Another advantage of using subqueries is improved readability. Subqueries can make your SQL code cleaner and easier to understand, especially for developers who are new to your project. Joins can be difficult to follow, especially when there are many tables involved or when the relationships between tables are complex. Subqueries can help simplify the code and make it easier for others to follow or reuse your logic.

### Increased Flexibility
Subqueries also offer increased flexibility compared to joins. With subqueries, you have more control over the order in which the data is retrieved, and you can easily modify the query to return the data you need. Joins are often more rigid, and making changes to the query can be more complex and time-consuming. In PostgreSQL, subqueries can be used to retrieve data from a single table and then join the results with another table, eliminating the need for complex join conditions.

Let's take a look at an example to see the difference between using joins and subqueries in PostgreSQL. Let's say we have two tables, “employee” and “department”. We want to retrieve the names of employees who work in a specific department.

Using Joins:

```sql
SELECT employee.name
FROM employee
INNER JOIN department
    ON employee.department_id = department.id
WHERE department.name = 'Engineering';
```

Using Subqueries:

```sql
SELECT name
FROM employee
WHERE department_id = (
    SELECT id
    FROM department
    WHERE name = 'Engineering'
);
```

The subquery is simpler and easier to understand than the join query in this case. The subquery allows us to retrieve the department ID for the specified department, and then use it to filter the employees who work in that department.

### Simplified Maintenance and Composability

Finally, using subqueries instead of joins can simplify maintenance. Because subqueries are easier to understand and modify, it is easier to make changes to your database without affecting other parts of your application. It is possible to compose a top-level query by importing and using queries defined in other source files and including them as subqueries via templating. Improvements or schema changes that affect the subqueries then are encapsulated away from the logic of the high-level query and other subqueries within the top-level query. In contrast, changes to joins can have a significant impact on other parts of your code and can be more difficult to maintain over time. To expand on this using the example above, if the department where you want to retrieve the employee names is split into two separate departments, but both departments are still joined to the same category in the "cost center" table the query above looks as follows:

Using Joins:

```sql
SELECT employee.name
FROM employee
INNER JOIN cost_center
    ON employee.cost_center_id = cost_center.id
WHERE cost_center.name = 'R&D';
```

The query had to change completely which seems negligible at this scale but adds up for complex queries. On the otherhand, using subqueries requires less changes:

```sql
SELECT name
FROM employee
WHERE cost_center_id = (
    SELECT id
    FROM cost_center
    WHERE name = 'R&D'
);
```

In conclusion, there are several advantages to using subqueries instead of joins in PostgreSQL. Whether you are dealing with large datasets, need to improve the readability of your code, or want to increase your flexibility and simplify maintenance, subqueries may be the better option for your project. Consider using subqueries the next time you need to combine data from multiple tables in PostgreSQL, and see the benefits for yourself!