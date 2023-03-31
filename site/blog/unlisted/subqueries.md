---
slug: subquery-vs-join
title: Subqueries vs Joins
authors: [depombo]
tags: [sql]
---

SQL is a powerful language that is widely used in database management systems. It allows for the manipulation of large data sets by performing operations such as querying, inserting, updating, and deleting data. Two common techniques used in SQL for retrieving data from multiple tables are joins and subqueries. In this blog post, we will explore the differences between these two techniques and when it makes sense to use one over the other.

### Refresher on joins and subqueries

Joins are used to combine rows from two or more tables based on a related column between them. There are different types of joins in SQL, including inner join, left join, right join, and full outer join. Inner join retrieves only the rows that have matching values in both tables, while left join retrieves all the rows from the left table and the matching rows from the right table. Right join, on the other hand, retrieves all the rows from the right table and the matching rows from the left table. Full outer join retrieves all the rows from both tables, whether there are matching values or not.

Subqueries are used to retrieve data from one table based on the results of a query on another table. They are enclosed in parentheses and can be used in different parts of a SQL statement, such as the `WHERE` clause, `HAVING` clause, and `FROM` clause. Subqueries can be correlated or non-correlated. Correlated subqueries are executed for each row of the outer query, while non-correlated subqueries are executed only once before the outer query is executed.

### Know when the hammer suits the nail

Joins and subqueries have their strengths and weaknesses. Joins are useful when retrieving data from multiple tables with related data, performing aggregation functions on related data, and when there are a small number of tables involved in the query. On the other hand, subqueries are useful when retrieving data from a table based on the results of a query on another table, performing complex calculations or conditional statements based on data from another table, and when there are multiple tables involved in the query and joins may become complex and difficult to manage.

### When Readability and Flexibility are important

The main advantage of using subqueries is improved readability. Subqueries can make your SQL code cleaner and easier to understand, especially for developers who are new to your project. Joins can be difficult to follow, especially when there are many tables involved or when the relationships between tables are complex. Subqueries can help simplify the code and make it easier for others to follow or reuse your logic.

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

Using subqueries instead of joins can simplify maintenance. Because subqueries are easier to understand and modify, it is easier to make changes to your database without affecting other parts of your application. It is possible to compose a top-level query by importing and using queries defined in other source files and including them as subqueries via templating. Improvements or schema changes that affect the subqueries then are encapsulated away from the logic of the high-level query and other subqueries within the top-level query. In contrast, changes to joins can have a significant impact on other parts of your code and can be more difficult to maintain over time. To expand on this using the example above, if the department where you want to retrieve the employee names is split into two separate departments, but both departments are still joined to the same category in the "cost center" table the query above looks as follows:

Using Joins:

```sql
SELECT employee.name
FROM employee
INNER JOIN cost_center
    ON employee.cost_center_id = cost_center.id
WHERE cost_center.name = 'R&D';
```

The query had to change completely which seems negligible at this scale but adds up for complex queries. On the other hand, using subqueries requires fewer changes:

```sql
SELECT name
FROM employee
WHERE cost_center_id = (
    SELECT id
    FROM cost_center
    WHERE name = 'R&D'
);
```

### What about Performance?

The last, but not least important, factor to consider is performance. There is no clear winner in terms of performance. Performance varies a lot depending on the data model, data volume, and query design. Joins can be resource-intensive, especially when dealing with large data sets or complex queries. Subqueries, on the other hand, can be faster and more efficient in some cases. It is essential to evaluate the complexity of the query and the size of the data sets involved to determine which technique is more appropriate.

Subqueries can sometimes be optimized and executed more efficiently than joins, especially when dealing with large amounts of data. In PostgreSQL, subqueries can be executed in parallel, which can significantly improve performance while a single query might not be able to utilize all the cores available. By breaking down the query into smaller parts, the database can use more computing resources, if available, but also any indexing and caching mechanisms to optimize the performance of the query. The main consideration for performance gains in subqueries is that the output of the sub-query itself will not be indexed, so the cardinality of the output needs to be much smaller than the inputs for the performance benefit to occur. In contrast, joins *can* be slower and more resource-intensive, especially when dealing with complex queries or large datasets. However, joins can mitigate the processing burden overhead on the database by replacing multiple queries with one join query. This in turn makes better use of the database's ability to search through, filter, and sort records. Having said that, as you add more joins to a query, the database server has to do more work, which translates to slower data retrieval times. Much like any performance computing optimization or [Amdal's Law](https://en.wikipedia.org/wiki/Amdahl%27s_law), more parallelization is not always the correct answer.

PostgreSQL offers a query analyzer that can help you better understand the performance characteristics of a given query. Simply prepend `EXPLAIN ANALYZE` before any given query. Historically, explicit joins have better performance, but query optimizers are getting better over time so it is best to write queries first in a logically coherent way, and then restructure if performance is a problem.

In conclusion, it is important to understand when a join or subquery makes more sense. There are some specific advantages to using subqueries instead of joins if you need to improve the readability of your code, or want to increase your flexibility and simplify maintenance, especially for teams with new entrants to SQL.