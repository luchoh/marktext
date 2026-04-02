# Diagram XSS Tests

```mermaid
graph TD
  A["<img src=x onerror='window.__marktextXss = 1'>"] --> B["safe"]
```

```flowchart
start=>start: <img src=x onerror="window.__marktextXss = 1">
end=>end: safe
start->end
```

```sequence
Alice->Bob: <img src=x onerror="window.__marktextXss = 1">
```

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "<script>window.__marktextXss = 1</script>",
  "data": {
    "values": [
      { "category": "<img src=x onerror='window.__marktextXss = 1'>", "value": 1 },
      { "category": "safe", "value": 2 }
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": { "field": "category", "type": "nominal" },
    "y": { "field": "value", "type": "quantitative" }
  }
}
```
