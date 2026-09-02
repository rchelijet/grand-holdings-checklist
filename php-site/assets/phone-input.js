(function () {
  function countryLabel(country) {
    return "(" + country.dialCode + ") " + country.name;
  }

  function filterCountries(countries, query) {
    var q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(function (country) {
      return (
        country.name.toLowerCase().indexOf(q) !== -1 ||
        country.dialCode.indexOf(q) !== -1 ||
        country.iso.toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function initPhoneInput(root) {
    var countries = JSON.parse(root.getAttribute("data-countries") || "[]");
    var search = root.querySelector(".phone-country-search");
    var hiddenDial = root.querySelector('input[type="hidden"][name$="_dial_code"]');
    var list = root.querySelector(".phone-country-list");
    var highlightIndex = 0;
    var open = false;

    function selectedCountry() {
      return (
        countries.find(function (c) {
          return c.dialCode === hiddenDial.value;
        }) || countries[0]
      );
    }

    function renderList(items) {
      list.innerHTML = "";
      items.forEach(function (country, index) {
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = countryLabel(country);
        if (index === highlightIndex) button.classList.add("active");
        if (country.dialCode === hiddenDial.value) button.classList.add("selected");
        button.addEventListener("mousedown", function (event) {
          event.preventDefault();
        });
        button.addEventListener("click", function () {
          hiddenDial.value = country.dialCode;
          search.value = countryLabel(country);
          closeList();
        });
        li.appendChild(button);
        list.appendChild(li);
      });
    }

    function openList() {
      open = true;
      list.hidden = false;
      search.setAttribute("aria-expanded", "true");
      highlightIndex = 0;
      renderList(filterCountries(countries, search.value === countryLabel(selectedCountry()) ? "" : search.value));
    }

    function closeList() {
      open = false;
      list.hidden = true;
      search.setAttribute("aria-expanded", "false");
      search.value = countryLabel(selectedCountry());
    }

    search.addEventListener("focus", function () {
      search.value = "";
      openList();
    });

    search.addEventListener("input", function () {
      highlightIndex = 0;
      if (!open) openList();
      else renderList(filterCountries(countries, search.value));
    });

    search.addEventListener("keydown", function (event) {
      var items = filterCountries(countries, search.value === "" ? "" : search.value);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
        renderList(items);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        highlightIndex = Math.max(highlightIndex - 1, 0);
        renderList(items);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (items[highlightIndex]) {
          hiddenDial.value = items[highlightIndex].dialCode;
          search.value = countryLabel(items[highlightIndex]);
          closeList();
        }
      } else if (event.key === "Escape") {
        closeList();
      }
    });

    document.addEventListener("mousedown", function (event) {
      if (!root.contains(event.target)) closeList();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-phone-input]").forEach(initPhoneInput);
  });
})();
